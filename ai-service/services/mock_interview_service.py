from __future__ import annotations

import json
import random
import re

from models.schemas import (
    FollowUpRequest,
    GenerateQuestionsRequest,
    MockInterviewFinishRequest,
    MockInterviewFinishResponse,
    MockInterviewNextRequest,
    MockInterviewNextResponse,
    MockInterviewStartRequest,
    MockInterviewStartResponse,
)
from services.interview_qa_service import (
    ROLE_CONTEXT,
    _call_gemini_json,
    _fallback_questions,
    _follow_up_fallback,
    _normalize_difficulty,
    _normalize_role,
    _profile_skills,
    _profile_summary,
    _resume_anchor_points,
    _resume_context_summary,
    _resume_topic_pool,
)
from utils.text_utils import (
    dedupe_lines,
    join_list_values,
    normalize_spaces,
    strip_markdown_noise,
    unique_text_items,
    word_count,
)


ENGLISH_ALIASES = {
    "basic": "basic",
    "beginner": "basic",
    "simple": "basic",
    "medium": "medium",
    "intermediate": "medium",
    "advanced": "advanced",
    "fluent": "advanced",
}

ENGLISH_GUIDANCE = {
    "basic": "Use simple, clear English. Ask shorter questions and avoid dense jargon.",
    "medium": "Use natural conversational English with moderate detail and professional tone.",
    "advanced": "Use polished professional English and sharper follow-up wording.",
}

ENGLISH_STYLE = {
    "basic": "clear and supportive",
    "medium": "natural and professional",
    "advanced": "polished and challenging",
}

INTERVIEW_LANES = [
    (
        "resume walkthrough",
        [
            "Walk me through one project or internship from your resume that best shows your strengths, and tell me what you personally owned.",
            "Which experience from your resume are you most confident discussing today, and why does it represent you well?",
        ],
    ),
    (
        "technical decisions",
        [
            "Tell me about a task where you had to make an important technical decision. What options did you consider and why did you choose your final approach?",
            "Pick one piece of work you are proud of and explain the main design or implementation decision behind it.",
        ],
    ),
    (
        "problem solving",
        [
            "Describe a difficult problem you faced in your work. How did you break it down and move toward a solution?",
            "Tell me about a time something was unclear or messy at first. How did you create a workable plan?",
        ],
    ),
    (
        "debugging",
        [
            "Describe a bug, failure, or unexpected result you handled. How did you find the root cause and what changed afterward?",
            "Tell me about a time your first solution did not work. How did you investigate and recover?",
        ],
    ),
    (
        "quality and testing",
        [
            "How do you make sure your work is correct and reliable before you submit, ship, or share it?",
            "Tell me about a time you improved quality, testing, validation, or review in your work.",
        ],
    ),
    (
        "communication",
        [
            "Tell me about a time you had to explain a technical idea, analysis, or decision to someone with a different background.",
            "How do you keep teammates or stakeholders aligned when you are working through something complex?",
        ],
    ),
    (
        "adaptability",
        [
            "Tell me about a time requirements changed midway. How did you adapt without losing momentum?",
            "Describe a situation where you had to learn something quickly to move the work forward.",
        ],
    ),
    (
        "impact",
        [
            "Which piece of your work had the clearest impact, and how did you measure or recognize that impact?",
            "Tell me about a time your work helped a user, teammate, or business outcome in a visible way.",
        ],
    ),
]


def _normalize_english_level(value: str | None) -> str:
    lowered = normalize_spaces(value).lower()
    return ENGLISH_ALIASES.get(lowered, "medium")


def _clip_text(text: str | None, limit: int = 420) -> str:
    cleaned = strip_markdown_noise(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def _coerce_text_list(value, *, limit: int = 4) -> list[str]:
    if isinstance(value, list):
        return unique_text_items([normalize_spaces(item) for item in value])[:limit]

    if isinstance(value, str):
        return dedupe_lines(value.splitlines())[:limit]

    return []


def _serialize_history(history: list, *, limit: int = 6) -> str:
    segments: list[str] = []
    for index, item in enumerate(history[-limit:], start=max(1, len(history) - limit + 1)):
        question = _clip_text(getattr(item, "question", ""), 240)
        answer = _clip_text(getattr(item, "answer", ""), 420)
        interviewer_reply = _clip_text(getattr(item, "interviewer_reply", ""), 180)

        if question:
            segments.append(f"Q{index}: {question}")
        if answer:
            segments.append(f"A{index}: {answer}")
        if interviewer_reply:
            segments.append(f"Interviewer reply {index}: {interviewer_reply}")

    return "\n".join(segments).strip() or "No previous transcript."


def _asked_questions(history: list, current_question: str = "") -> list[str]:
    return unique_text_items(
        [
            *[normalize_spaces(getattr(item, "question", "")) for item in history],
            normalize_spaces(current_question),
        ]
    )


def _infer_focus_area(question: str, role: str) -> str:
    lowered = normalize_spaces(question).lower()

    if any(marker in lowered for marker in ("react", "ui", "frontend", "accessibility", "state")):
        return "frontend implementation"
    if any(marker in lowered for marker in ("api", "database", "backend", "cache", "latency", "auth")):
        return "backend systems"
    if any(marker in lowered for marker in ("tradeoff", "scale", "architecture", "design")):
        return "system design"
    if any(marker in lowered for marker in ("debug", "bug", "failure", "production")):
        return "debugging"

    return ROLE_CONTEXT[role]["scenario"]


def _fallback_opening(role: str, english_level: str, total_questions: int) -> str:
    if english_level == "basic":
        return (
            f"Hi, welcome. I reviewed your resume and we will go through {total_questions} questions. "
            "Please answer in simple, honest English with real examples."
        )

    if english_level == "advanced":
        return (
            f"Thanks for joining. I reviewed your resume and we will work through {total_questions} realistic questions "
            "with deeper follow-ups around your decisions, tradeoffs, and impact."
        )

    return (
        f"Thanks for joining. I reviewed your resume and we will work through {total_questions} realistic questions. "
        "Answer naturally and use examples from your own work whenever possible."
    )


def _fallback_reply(answer: str, english_level: str) -> str:
    answer_words = word_count(answer)
    has_example = bool(re.search(r"\b(example|project|built|implemented|used)\b", answer, flags=re.IGNORECASE))
    has_reasoning = bool(re.search(r"\b(because|tradeoff|impact|result|performance|scale)\b", answer, flags=re.IGNORECASE))

    if answer_words < 25:
        return (
            "Thanks. That is a start, but I would like a more detailed and concrete answer."
            if english_level != "basic"
            else "Thanks. Please give me a little more detail and one clear example."
        )

    if has_example and has_reasoning:
        return (
            "That gives me a useful picture of your thinking. Let me push a little deeper on that."
            if english_level != "basic"
            else "Good. I can see your example. Let me ask one deeper question."
        )

    if has_example:
        return (
            "Thanks, the example helps. I want to understand your decision-making more clearly."
            if english_level != "basic"
            else "Thanks, your example helps. Now I want to know why you chose that approach."
        )

    return (
        "I understand the direction. Now I want to hear a more specific scenario from your experience."
        if english_level != "basic"
        else "I understand. Now tell me one real situation where you did this."
    )


def _answer_needs_follow_up(answer: str) -> bool:
    normalized = normalize_spaces(answer)
    answer_words = word_count(normalized)
    has_example = bool(re.search(r"\b(example|project|internship|built|used|worked|handled)\b", normalized, flags=re.IGNORECASE))
    has_reasoning = bool(re.search(r"\b(because|why|tradeoff|impact|result|decision|approach)\b", normalized, flags=re.IGNORECASE))
    return answer_words < 28 or (answer_words < 50 and not (has_example or has_reasoning))


def _broad_fallback_questions(
    data: MockInterviewNextRequest,
    role: str,
    skills: list[str],
) -> list[tuple[str, str]]:
    topic_pool = [topic for topic, _ in _resume_topic_pool(role, skills, data)]
    resume_anchors = _resume_anchor_points(role, skills, data)
    topic_hint = resume_anchors[0] if resume_anchors else (topic_pool[0] if topic_pool else "")
    questions: list[tuple[str, str]] = []
    lane_pool = INTERVIEW_LANES[:]
    random.shuffle(lane_pool)

    for focus_area, templates in lane_pool:
        template_pool = templates[:]
        random.shuffle(template_pool)
        for template in template_pool:
            question = normalize_spaces(template)
            if topic_hint and focus_area in {"technical decisions", "problem solving", "impact"}:
                question = normalize_spaces(f"{question} If useful, connect it to {topic_hint}.")
            questions.append((question, focus_area))

    return questions


def _fallback_next_question(data: MockInterviewNextRequest, role: str, difficulty: str, skills: list[str]) -> tuple[str, str]:
    asked_questions = {item.lower() for item in _asked_questions(data.history, data.current_question)}

    if _answer_needs_follow_up(data.user_answer):
        follow_up = _follow_up_fallback(
            FollowUpRequest(
                question=data.current_question,
                user_answer=data.user_answer,
                role=role,
                difficulty=difficulty,
            )
        )
        follow_up_question = normalize_spaces(follow_up.follow_up_question)
        if follow_up_question and follow_up_question.lower() not in asked_questions:
            return follow_up_question, _infer_focus_area(follow_up_question, role)

    for question, focus_area in _broad_fallback_questions(data, role, skills):
        if question and question.lower() not in asked_questions:
            return question, focus_area

    fallback_questions = _fallback_questions(
        GenerateQuestionsRequest(
            skills=data.skills,
            projects=data.projects or "",
            experience=data.experience or "",
            resume_text=data.resume_text or "",
            resume_summary=data.resume_summary or "",
            resume_skills=data.resume_skills,
            role=role,
            difficulty=difficulty,
            exclude_questions=list(asked_questions),
            count=max(4, min(data.total_questions + 1, 8)),
        ),
        role,
        difficulty,
        skills,
    )

    for item in fallback_questions:
        question = normalize_spaces(item.question)
        if question and question.lower() not in asked_questions:
            return question, normalize_spaces(item.focus_area) or _infer_focus_area(question, role)

    generic_question = "Tell me about a project decision where you had to balance speed, quality, and maintainability."
    return generic_question, _infer_focus_area(generic_question, role)


def _fallback_finish(data: MockInterviewFinishRequest, role: str) -> MockInterviewFinishResponse:
    answers = [normalize_spaces(item.answer) for item in data.history if normalize_spaces(item.answer)]
    combined_answers = " ".join(answers)
    average_words = sum(word_count(answer) for answer in answers) / max(len(answers), 1)
    has_examples = bool(re.search(r"\b(example|project|built|implemented|used)\b", combined_answers, flags=re.IGNORECASE))
    has_reasoning = bool(
        re.search(r"\b(because|tradeoff|impact|result|performance|scale|latency|reliability)\b", combined_answers, flags=re.IGNORECASE)
    )
    has_ownership = bool(re.search(r"\b(i|my|we)\b", combined_answers, flags=re.IGNORECASE))

    strengths: list[str] = []
    improvements: list[str] = []

    if average_words >= 55:
        strengths.append("You usually gave enough detail for the interviewer to understand your process.")
    else:
        improvements.append("Add more structure and detail so each answer feels complete.")

    if has_examples:
        strengths.append("You used project-based examples, which made your answers more believable.")
    else:
        improvements.append("Bring in one concrete project or internship example more often.")

    if has_reasoning:
        strengths.append("You explained decisions and tradeoffs instead of only listing steps.")
    else:
        improvements.append("Explain why you made certain choices so your thinking sounds stronger.")

    if not has_ownership:
        improvements.append("Use first-person ownership more clearly so the interviewer knows what you personally did.")

    communication_score = 58
    if average_words >= 40:
        communication_score += 10
    if average_words >= 70:
        communication_score += 6
    if has_examples:
        communication_score += 7

    technical_score = 56
    if has_reasoning:
        technical_score += 14
    if has_examples:
        technical_score += 8
    if len(data.history) >= max(3, data.total_questions - 1):
        technical_score += 5

    confidence_score = 57
    if has_ownership:
        confidence_score += 11
    if average_words >= 45:
        confidence_score += 8
    if has_reasoning:
        confidence_score += 6

    communication_score = max(0, min(100, communication_score))
    technical_score = max(0, min(100, technical_score))
    confidence_score = max(0, min(100, confidence_score))
    overall_score = round((communication_score + technical_score + confidence_score) / 3)

    strengths = dedupe_lines(strengths)[:3] or [
        "You stayed engaged through the interview and addressed the questions directly.",
    ]
    improvements = dedupe_lines(improvements)[:3] or [
        "Keep sharpening your project examples so they land faster and sound more specific.",
    ]

    integrity_note = ""
    if data.proctor_flags:
        integrity_note = (
            f"Interview integrity signals were raised {len(data.proctor_flags)} time(s). "
            "Review focus, tab switching, or camera presence before the next practice run."
        )

    summary = (
        f"This {ROLE_CONTEXT[role]['label']} mock interview showed a promising base. "
        f"Your overall score is {overall_score}/100, with the strongest signals in "
        f"{'communication' if communication_score >= technical_score and communication_score >= confidence_score else 'technical thinking' if technical_score >= confidence_score else 'confidence'}. "
        "To improve further, make each answer more example-driven, explain tradeoffs clearly, and keep ownership language strong."
    )
    hiring_signal = (
        "Borderline interview-ready with stronger project grounding and clearer decision-making."
        if overall_score < 80
        else "Interview-ready signal with solid communication and practical reasoning."
    )
    communication_summary = (
        "Your communication is strongest when you use one clear example and keep the answer structured from problem to result."
    )
    technical_summary = (
        "Your technical signal improves when you explain why you chose an approach, not just the steps you followed."
    )
    confidence_summary = (
        "Your confidence rises when you speak with clear ownership and finish with a measurable outcome or lesson."
    )
    next_steps = [
        "Prepare 3 resume-backed stories with clear ownership, tradeoffs, and outcomes.",
        "Practice answering one debugging question and one design question aloud.",
        "Tighten your openings so each answer reaches the concrete example faster.",
    ]

    return MockInterviewFinishResponse(
        summary=summary,
        strengths=strengths,
        improvements=improvements,
        overall_score=overall_score,
        communication_score=communication_score,
        technical_score=technical_score,
        confidence_score=confidence_score,
        hiring_signal=hiring_signal,
        communication_summary=communication_summary,
        technical_summary=technical_summary,
        confidence_summary=confidence_summary,
        next_steps=next_steps,
        integrity_note=integrity_note,
        fallback_used=True,
    )


def start_mock_interview(data: MockInterviewStartRequest) -> MockInterviewStartResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    english_level = _normalize_english_level(data.english_level)
    total_questions = max(3, min(8, int(data.total_questions or 5)))
    skills = _profile_skills(data.skills, data.resume_skills, role)
    resume_context = _resume_context_summary(data.resume_summary, data.resume_text)
    resume_anchors = _resume_anchor_points(role, skills, data)
    profile_summary = _profile_summary(
        skills,
        data.projects or "",
        data.experience or "",
        role,
        data.resume_summary,
        data.resume_text,
    )

    prompt = f"""
Return only valid JSON.

You are conducting a live mock interview after reviewing a student's uploaded resume.
The student's resume most closely aligns with a {ROLE_CONTEXT[role]['label']} profile. Use that only as background context, not as the visible focus.

Student profile:
- {profile_summary}
- Resume context: {resume_context}
- Resume anchors to prioritize: {json.dumps(resume_anchors, ensure_ascii=True)}
- English level: {english_level}
- Interview difficulty: {difficulty}
- Total interview questions planned: {total_questions}

Rules:
- Sound like a calm, professional human interviewer.
- The opening must be 1 to 2 short sentences.
- Ask exactly one first question.
- Personalize the first question to a concrete resume anchor such as a project, internship, tool, achievement, metric, coursework, or responsibility.
- Make the interviewer sound like they actually reviewed the candidate's work, not like a generic interview bot.
- If the resume shows a strong project, measurable outcome, dashboard, dataset, API, feature, internship, or technical decision, use that directly.
- Prefer a resume-specific question over a generic role-template question.
- Do not mention the inferred role in the opening unless the resume itself makes it necessary.
- Match the wording to this guidance: {ENGLISH_GUIDANCE[english_level]}
- Do not mention being an AI or mention JSON.

JSON shape:
{{
  "opening": "string",
  "first_question": "string",
  "interviewer_style": "one short sentence",
  "candidate_brief": "one short sentence that sets expectations for the candidate",
  "focus_areas": ["string", "string", "string"]
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a realistic software interviewer running a live mock interview. "
                "Speak naturally, stay concise, and return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.9,
            max_output_tokens=700,
        )
        opening = strip_markdown_noise(payload.get("opening", "")) if isinstance(payload, dict) else ""
        first_question = normalize_spaces(payload.get("first_question", "")) if isinstance(payload, dict) else ""
        interviewer_style = normalize_spaces(payload.get("interviewer_style", "")) if isinstance(payload, dict) else ""
        candidate_brief = normalize_spaces(payload.get("candidate_brief", "")) if isinstance(payload, dict) else ""
        focus_areas = _coerce_text_list(payload.get("focus_areas", [])) if isinstance(payload, dict) else []

        if not opening or not first_question:
            raise ValueError("Missing start payload")

        return MockInterviewStartResponse(
            opening=opening,
            first_question=first_question,
            interviewer_style=interviewer_style or f"{ENGLISH_STYLE[english_level]} interviewer tone",
            candidate_brief=candidate_brief or "Expect resume-based questions that test ownership, tradeoffs, and communication.",
            focus_areas=focus_areas[:4] or resume_anchors[:4],
            role=role,
            difficulty=difficulty,
            english_level=english_level,
            total_questions=total_questions,
            fallback_used=False,
        )
    except Exception:
        fallback_questions = _fallback_questions(
            GenerateQuestionsRequest(
                skills=data.skills,
                projects=data.projects or "",
                experience=data.experience or "",
                resume_text=data.resume_text or "",
                resume_summary=data.resume_summary or "",
                resume_skills=data.resume_skills,
                role=role,
                difficulty=difficulty,
                count=max(4, total_questions),
            ),
            role,
            difficulty,
            skills,
        )
        first_question = (
            normalize_spaces(fallback_questions[0].question)
            if fallback_questions
            else "Tell me about a project from your resume and the most important technical decision you made."
        )

        return MockInterviewStartResponse(
            opening=_fallback_opening(role, english_level, total_questions),
            first_question=first_question,
            interviewer_style=f"{ENGLISH_STYLE[english_level]} interviewer tone",
            candidate_brief="Expect a realistic flow with project depth, decision-making, and communication checks.",
            focus_areas=resume_anchors[:4] or [item[0] for item in INTERVIEW_LANES[:3]],
            role=role,
            difficulty=difficulty,
            english_level=english_level,
            total_questions=total_questions,
            fallback_used=True,
        )


def continue_mock_interview(data: MockInterviewNextRequest) -> MockInterviewNextResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    english_level = _normalize_english_level(data.english_level)
    question_index = max(1, int(data.question_index or 1))
    total_questions = max(3, min(8, int(data.total_questions or 5)))
    skills = _profile_skills(data.skills, data.resume_skills, role)
    resume_anchors = _resume_anchor_points(role, skills, data)
    profile_summary = _profile_summary(
        skills,
        data.projects or "",
        data.experience or "",
        role,
        data.resume_summary,
        data.resume_text,
    )

    if question_index >= total_questions:
        reply = _fallback_reply(data.user_answer, english_level)
        closing = (
            "Thanks, that wraps up the interview. I appreciate the way you stayed with the discussion."
            if english_level != "basic"
            else "Thanks, that is the end of the interview. I appreciate your effort."
        )
        return MockInterviewNextResponse(
            interviewer_reply=reply,
            next_question="",
            should_end=True,
            closing_remark=closing,
            focus_area="closing",
            answer_signal="You completed the planned interview flow.",
            coaching_tip="Review your last answer and note one place where you could add clearer ownership or outcome.",
            fallback_used=True,
        )

    transcript = _serialize_history(data.history)
    asked_questions = _asked_questions(data.history, data.current_question)

    prompt = f"""
Return only valid JSON.

You are a realistic human interviewer running a live mock interview after reviewing the student's uploaded resume.
The student's resume most closely aligns with a {ROLE_CONTEXT[role]['label']} profile. Use that only as background context.

Student profile:
- {profile_summary}
- Resume anchors still available: {json.dumps(resume_anchors, ensure_ascii=True)}
- English level: {english_level}
- Difficulty: {difficulty}

Interview progress:
- Current question number answered: {question_index}
- Total planned questions: {total_questions}
- Questions already asked: {json.dumps(asked_questions, ensure_ascii=True)}

Conversation so far:
{transcript}

Current question:
{normalize_spaces(data.current_question)}

Student answer:
{strip_markdown_noise(data.user_answer)}

Rules:
- First respond like a human interviewer in 1 or 2 short sentences.
- Then ask exactly one next question.
- The next question can be a sharper follow-up or a natural transition to the next topic.
- Use the resume, projects, and earlier answers as the primary source for the next question.
- Sound like the same interviewer from earlier in the conversation, not a reset or template.
- Prefer deepening a concrete resume item or answer over asking a generic canned role question.
- If the student's answer mentioned a tool, dataset, metric, bug, stakeholder decision, UI choice, or system tradeoff, use that as the follow-up target.
- Do not repeat earlier questions.
- Match the wording to this guidance: {ENGLISH_GUIDANCE[english_level]}
- Keep the next question realistic for a live face-to-face interview.
- Do not mention being an AI or mention JSON.

JSON shape:
{{
  "interviewer_reply": "string",
  "next_question": "string",
  "focus_area": "short topic label",
  "answer_signal": "one short sentence about how the last answer landed",
  "coaching_tip": "one short sentence on what to improve in the next answer"
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a realistic software interviewer in a live mock interview. "
                "Respond naturally, ask one strong next question, and return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.93,
            max_output_tokens=900,
        )
        interviewer_reply = (
            strip_markdown_noise(payload.get("interviewer_reply", "")) if isinstance(payload, dict) else ""
        )
        next_question = normalize_spaces(payload.get("next_question", "")) if isinstance(payload, dict) else ""
        focus_area = normalize_spaces(payload.get("focus_area", "")) if isinstance(payload, dict) else ""
        answer_signal = normalize_spaces(payload.get("answer_signal", "")) if isinstance(payload, dict) else ""
        coaching_tip = normalize_spaces(payload.get("coaching_tip", "")) if isinstance(payload, dict) else ""

        if not interviewer_reply or not next_question or next_question.lower() in {item.lower() for item in asked_questions}:
            raise ValueError("Invalid next-turn payload")

        return MockInterviewNextResponse(
            interviewer_reply=interviewer_reply,
            next_question=next_question,
            should_end=False,
            closing_remark="",
            focus_area=focus_area or _infer_focus_area(next_question, role),
            answer_signal=answer_signal or "The answer is moving in the right direction, but the next response should be even more concrete.",
            coaching_tip=coaching_tip or "Use one specific example, one clear decision, and one outcome in your next answer.",
            fallback_used=False,
        )
    except Exception:
        next_question, focus_area = _fallback_next_question(data, role, difficulty, skills)
        return MockInterviewNextResponse(
            interviewer_reply=_fallback_reply(data.user_answer, english_level),
            next_question=next_question,
            should_end=False,
            closing_remark="",
            focus_area=focus_area,
            answer_signal="Your previous answer would sound stronger with more concrete detail and clearer reasoning.",
            coaching_tip="In the next answer, use one real example and explain why your approach made sense.",
            fallback_used=True,
        )


def finish_mock_interview(data: MockInterviewFinishRequest) -> MockInterviewFinishResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    english_level = _normalize_english_level(data.english_level)
    skills = _profile_skills(data.skills, data.resume_skills, role)
    profile_summary = _profile_summary(
        skills,
        data.projects or "",
        data.experience or "",
        role,
        data.resume_summary,
        data.resume_text,
    )
    transcript = _serialize_history(data.history, limit=12)

    prompt = f"""
Return only valid JSON.

You are finishing a mock interview for a student targeting a {ROLE_CONTEXT[role]['label']} role.

Student profile:
- {profile_summary}
- English level: {english_level}
- Difficulty: {difficulty}
- Planned questions: {data.total_questions}

Interview transcript:
{transcript}

Integrity signals:
{json.dumps(unique_text_items(data.proctor_flags), ensure_ascii=True)}

Rules:
- Write a concise, honest summary like a human interviewer.
- Give exactly 3 strengths and up to 3 improvements.
- Score overall performance, communication, technical thinking, and confidence from 0 to 100.
- If integrity signals exist, mention them briefly in the integrity note.
- Do not mention being an AI or mention JSON.

JSON shape:
{{
  "summary": "string",
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "overall_score": 0,
  "communication_score": 0,
  "technical_score": 0,
  "confidence_score": 0,
  "hiring_signal": "string",
  "communication_summary": "string",
  "technical_summary": "string",
  "confidence_summary": "string",
  "next_steps": ["string", "string", "string"],
  "integrity_note": "string"
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a realistic interviewer delivering a short, honest mock interview debrief. "
                "Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.68,
            max_output_tokens=1400,
        )
        summary = strip_markdown_noise(payload.get("summary", "")) if isinstance(payload, dict) else ""
        strengths = _coerce_text_list(payload.get("strengths", [])) if isinstance(payload, dict) else []
        improvements = _coerce_text_list(payload.get("improvements", [])) if isinstance(payload, dict) else []
        integrity_note = normalize_spaces(payload.get("integrity_note", "")) if isinstance(payload, dict) else ""
        overall_score = int(payload.get("overall_score", 0)) if isinstance(payload, dict) else 0
        communication_score = int(payload.get("communication_score", 0)) if isinstance(payload, dict) else 0
        technical_score = int(payload.get("technical_score", 0)) if isinstance(payload, dict) else 0
        confidence_score = int(payload.get("confidence_score", 0)) if isinstance(payload, dict) else 0
        hiring_signal = normalize_spaces(payload.get("hiring_signal", "")) if isinstance(payload, dict) else ""
        communication_summary = normalize_spaces(payload.get("communication_summary", "")) if isinstance(payload, dict) else ""
        technical_summary = normalize_spaces(payload.get("technical_summary", "")) if isinstance(payload, dict) else ""
        confidence_summary = normalize_spaces(payload.get("confidence_summary", "")) if isinstance(payload, dict) else ""
        next_steps = _coerce_text_list(payload.get("next_steps", [])) if isinstance(payload, dict) else []

        if not summary:
            raise ValueError("Missing finish summary")

        return MockInterviewFinishResponse(
            summary=summary,
            strengths=strengths[:3],
            improvements=improvements[:3],
            overall_score=max(0, min(100, overall_score)),
            communication_score=max(0, min(100, communication_score)),
            technical_score=max(0, min(100, technical_score)),
            confidence_score=max(0, min(100, confidence_score)),
            hiring_signal=hiring_signal or "Promising signal with room to become more specific and decisive.",
            communication_summary=communication_summary or "Communication improves most when you answer with clearer structure and faster examples.",
            technical_summary=technical_summary or "Technical strength is highest when you explain the why behind your decisions.",
            confidence_summary=confidence_summary or "Confidence rises when you speak with ownership and close with measurable impact.",
            next_steps=next_steps[:4] or [
                "Prepare 3 concise resume-backed answer stories.",
                "Practice stronger openings and clearer ownership language.",
                "Add one tradeoff or validation step to each technical answer.",
            ],
            integrity_note=integrity_note,
            fallback_used=False,
        )
    except Exception:
        return _fallback_finish(data, role)
