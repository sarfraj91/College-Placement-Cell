from __future__ import annotations

import json
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
    _resume_context_summary,
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


def _normalize_english_level(value: str | None) -> str:
    lowered = normalize_spaces(value).lower()
    return ENGLISH_ALIASES.get(lowered, "medium")


def _clip_text(text: str | None, limit: int = 420) -> str:
    cleaned = strip_markdown_noise(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


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
    role_label = ROLE_CONTEXT[role]["label"]

    if english_level == "basic":
        return (
            f"Hi, welcome. I will take your {role_label} mock interview today. "
            f"We will go through {total_questions} questions, and I want simple, honest answers with examples."
        )

    if english_level == "advanced":
        return (
            f"Thanks for joining. I will be your {role_label} interviewer today, and we will work through "
            f"{total_questions} realistic questions with follow-ups where your decisions need deeper justification."
        )

    return (
        f"Thanks for joining. I will act as your {role_label} interviewer today. "
        f"We will work through {total_questions} realistic questions, so answer naturally and use examples from your work whenever possible."
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


def _fallback_next_question(data: MockInterviewNextRequest, role: str, difficulty: str, skills: list[str]) -> tuple[str, str]:
    asked_questions = {item.lower() for item in _asked_questions(data.history, data.current_question)}

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

    return MockInterviewFinishResponse(
        summary=summary,
        strengths=strengths,
        improvements=improvements,
        overall_score=overall_score,
        communication_score=communication_score,
        technical_score=technical_score,
        confidence_score=confidence_score,
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

You are conducting a live mock interview as a realistic human interviewer for a student targeting a {ROLE_CONTEXT[role]['label']} role.

Student profile:
- {profile_summary}
- Resume context: {resume_context}
- English level: {english_level}
- Interview difficulty: {difficulty}
- Total interview questions planned: {total_questions}

Rules:
- Sound like a calm, professional human interviewer.
- The opening must be 1 to 2 short sentences.
- Ask exactly one first question.
- Personalize the first question to the student's resume, projects, skills, or likely interview goals.
- Match the wording to this guidance: {ENGLISH_GUIDANCE[english_level]}
- Do not mention being an AI or mention JSON.

JSON shape:
{{
  "opening": "string",
  "first_question": "string",
  "interviewer_style": "one short sentence"
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

        if not opening or not first_question:
            raise ValueError("Missing start payload")

        return MockInterviewStartResponse(
            opening=opening,
            first_question=first_question,
            interviewer_style=interviewer_style or f"{ENGLISH_STYLE[english_level]} interviewer tone",
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
            fallback_used=True,
        )

    transcript = _serialize_history(data.history)
    asked_questions = _asked_questions(data.history, data.current_question)

    prompt = f"""
Return only valid JSON.

You are a realistic human interviewer running a live mock interview for a student targeting a {ROLE_CONTEXT[role]['label']} role.

Student profile:
- {profile_summary}
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
- Do not repeat earlier questions.
- Match the wording to this guidance: {ENGLISH_GUIDANCE[english_level]}
- Keep the next question realistic for a live face-to-face interview.
- Do not mention being an AI or mention JSON.

JSON shape:
{{
  "interviewer_reply": "string",
  "next_question": "string",
  "focus_area": "short topic label"
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

        if not interviewer_reply or not next_question or next_question.lower() in {item.lower() for item in asked_questions}:
            raise ValueError("Invalid next-turn payload")

        return MockInterviewNextResponse(
            interviewer_reply=interviewer_reply,
            next_question=next_question,
            should_end=False,
            closing_remark="",
            focus_area=focus_area or _infer_focus_area(next_question, role),
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
        strengths = unique_text_items(payload.get("strengths", [])) if isinstance(payload, dict) else []
        improvements = unique_text_items(payload.get("improvements", [])) if isinstance(payload, dict) else []
        integrity_note = normalize_spaces(payload.get("integrity_note", "")) if isinstance(payload, dict) else ""
        overall_score = int(payload.get("overall_score", 0)) if isinstance(payload, dict) else 0
        communication_score = int(payload.get("communication_score", 0)) if isinstance(payload, dict) else 0
        technical_score = int(payload.get("technical_score", 0)) if isinstance(payload, dict) else 0
        confidence_score = int(payload.get("confidence_score", 0)) if isinstance(payload, dict) else 0

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
            integrity_note=integrity_note,
            fallback_used=False,
        )
    except Exception:
        return _fallback_finish(data, role)
