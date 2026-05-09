from __future__ import annotations

import json

from google import genai
from google.genai import types

from models.schemas import ChatContext, ChatResponse, ChatResponseSection
from services.env_loader import get_gemini_settings
from services.embedding_service import analyze_skill_gap_from_skills
from services.intent_service import detect_intent, is_greeting_message
from services.job_service import build_chat_job_suggestions
from services.model_loder import ModelRegistry
from services.rag_service import build_grounded_context, retrieve_relevant_sections
from utils.text_utils import (
    clean_chatbot_response,
    dedupe_lines,
    join_list_values,
    normalize_spaces,
    strip_markdown_noise,
    unique_text_items,
)

DEFAULT_MODEL = "gemini-2.5-flash"


def get_client() -> tuple[genai.Client, str]:
    api_key, model_name = get_gemini_settings(DEFAULT_MODEL)
    return genai.Client(api_key=api_key), model_name


def _extract_json_payload(raw_text: str) -> dict:
    text = str(raw_text or "").strip()
    if not text:
        raise ValueError("Empty chatbot response")

    try:
        payload = json.loads(text)
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Unable to parse chatbot JSON payload")

    payload = json.loads(text[start : end + 1])
    return payload if isinstance(payload, dict) else {}


def _extract_response_payload(response) -> dict:
    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        if hasattr(parsed, "model_dump"):
            parsed = parsed.model_dump()
        return parsed if isinstance(parsed, dict) else {}

    return _extract_json_payload(getattr(response, "text", "") or "")


def _coerce_text_list(value, *, limit: int = 4) -> list[str]:
    if isinstance(value, list):
        return unique_text_items([str(item) for item in value])[:limit]

    if isinstance(value, str):
        return dedupe_lines(value.splitlines())[:limit]

    return []


def _coerce_sections(value, *, limit: int = 3) -> list[ChatResponseSection]:
    if not isinstance(value, list):
        return []

    sections: list[ChatResponseSection] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        title = normalize_spaces(item.get("title", ""))
        items = _coerce_text_list(item.get("items", []), limit=4)
        if not title or not items:
            continue

        sections.append(ChatResponseSection(title=title, items=items))
        if len(sections) >= limit:
            break

    return sections


def _serialize_history(history: list, *, limit: int = 6) -> str:
    entries: list[str] = []
    for item in history[-limit:]:
        role = normalize_spaces(getattr(item, "role", "")).upper() or "USER"
        content = normalize_spaces(getattr(item, "content", ""))
        if not content:
            continue
        entries.append(f"{role}: {content}")
    return "\n".join(entries) or "No previous messages."


def _student_profile_summary(context: ChatContext | None) -> str:
    profile = context.student_profile if context else None
    if not profile:
        return "Student profile not available."

    parts = [
        f"Name: {normalize_spaces(profile.fullname)}" if profile.fullname else "",
        f"Branch: {normalize_spaces(profile.branch)}" if profile.branch else "",
        f"CGPA: {profile.cgpa}" if profile.cgpa is not None else "",
        f"Graduation year: {profile.graduation_year}" if profile.graduation_year else "",
        f"Placement status: {normalize_spaces(profile.placement_status)}" if profile.placement_status else "",
        (
            f"Skills: {join_list_values(profile.skills[:8], 'Not provided')}"
            if profile.skills
            else ""
        ),
        (
            f"Internships: {normalize_spaces(profile.internships)}"
            if profile.internships
            else ""
        ),
        f"Projects: {normalize_spaces(profile.projects)}" if profile.projects else "",
        f"Summary: {normalize_spaces(profile.summary)}" if profile.summary else "",
    ]
    return "\n".join(item for item in parts if item) or "Student profile not available."


def _active_job_summary(context: ChatContext | None) -> str:
    active_job = context.active_job if context else None
    if not active_job or not normalize_spaces(active_job.job_title):
        return "No specific active job selected."

    parts = [
        f"Role: {normalize_spaces(active_job.job_title)}",
        f"Company: {normalize_spaces(active_job.company)}" if active_job.company else "",
        f"Location: {normalize_spaces(active_job.location)}" if active_job.location else "",
        f"Work mode: {normalize_spaces(active_job.work_mode)}" if active_job.work_mode else "",
        (
            f"Required skills: {join_list_values(active_job.skills[:8], 'Not specified')}"
            if active_job.skills
            else ""
        ),
        f"Description: {normalize_spaces(active_job.description)}" if active_job.description else "",
    ]
    return "\n".join(item for item in parts if item)


def _resume_analysis_summary(context: ChatContext | None) -> str:
    analysis = context.resume_analysis if context else None
    if not analysis:
        return "Resume analysis not available."

    parts = [
        (
            f"Final score: {analysis.final_score}"
            if analysis.final_score is not None
            else ""
        ),
        (
            f"Matched skills: {join_list_values(analysis.matched_skills[:8], 'None yet')}"
            if analysis.matched_skills
            else ""
        ),
        (
            f"Missing skills: {join_list_values(analysis.missing_skills[:8], 'None identified')}"
            if analysis.missing_skills
            else ""
        ),
        (
            f"Skill gap percent: {analysis.skill_gap_percent}%"
            if analysis.skill_gap_percent is not None
            else ""
        ),
        (
            f"Suggestions: {join_list_values(analysis.suggestions[:5], 'No suggestions yet')}"
            if analysis.suggestions
            else ""
        ),
    ]
    return "\n".join(item for item in parts if item) or "Resume analysis not available."


def _recommendation_summary(context: ChatContext | None) -> str:
    if not context:
        return "No recommendation context available."

    combined = [*context.recommended_jobs[:3], *context.external_jobs[:2]]
    lines: list[str] = []
    for item in combined:
        title = normalize_spaces(item.job_title)
        if not title:
            continue
        company = normalize_spaces(item.company)
        matched_skills = join_list_values(item.matched_skills[:4], "")
        line = f"{title}"
        if company:
            line += f" at {company}"
        if matched_skills:
            line += f" | matched skills: {matched_skills}"
        lines.append(line)

    return "\n".join(lines) or "No recommendation context available."


def _match_topics(intent_data: dict, context: ChatContext | None, jobs: list) -> list[str]:
    topics = [intent_data.get("intent", "general"), *intent_data.get("secondary_intents", [])]
    if context and context.active_job and normalize_spaces(context.active_job.job_title):
        topics.append(context.active_job.job_title)
    if jobs:
        topics.append("job matching")
    return unique_text_items(topics)[:5]


def _fallback_chat_payload(
    *,
    question: str,
    intent: str,
    context: ChatContext | None,
    jobs: list,
    gap_analysis,
) -> dict:
    active_job_title = (
        normalize_spaces(context.active_job.job_title)
        if context and context.active_job
        else ""
    )
    missing_skills = list(getattr(gap_analysis, "missing_skills", []) or [])[:4]
    matched_skills = list(getattr(gap_analysis, "matched_skills", []) or [])[:4]
    resume_suggestions = (
        list(getattr(context.resume_analysis, "suggestions", []) or [])[:3]
        if context and context.resume_analysis
        else []
    )

    if intent == "jobs":
        answer_title = "Role-Fit Snapshot"
        answer = (
            f"Based on the information shared, focus on roles that match your strongest current skills"
            f"{f' and the selected job target {active_job_title}' if active_job_title else ''}. "
            "The fastest improvement comes from applying where you already have overlap, while closing only the highest-impact missing skills."
        )
        sections = [
            ChatResponseSection(
                title="Where You Fit Best",
                items=(
                    [f"{job.title}: {job.reason}" for job in jobs[:3]]
                    if jobs
                    else ["Apply to roles with direct overlap in your current stack and recent projects."]
                ),
            ),
            ChatResponseSection(
                title="What To Strengthen Next",
                items=missing_skills or ["Pick 2 to 3 role-specific skills and build proof through projects or internships."],
            ),
        ]
        next_steps = unique_text_items(
            [
                "Shortlist 5 roles where your current stack already matches the core requirements.",
                "Tailor your resume bullets to the most repeated keywords in those job descriptions.",
                *resume_suggestions,
            ]
        )[:3]
        follow_ups = [
            "Which of these roles matches my profile best right now?",
            "What projects should I build to improve my job fit?",
            "How should I tailor my resume for these openings?",
        ]
    elif intent == "interview":
        answer_title = "Interview Coaching Plan"
        answer = (
            "Your answers will sound stronger if you lead with the problem, explain your decision-making clearly, "
            "and close with the result or lesson. Keep each answer grounded in one real project or internship example."
        )
        sections = [
            ChatResponseSection(
                title="What Good Answers Include",
                items=[
                    "A short setup of the problem or task.",
                    "The action you personally took.",
                    "A tradeoff, metric, or result that proves impact.",
                ],
            ),
            ChatResponseSection(
                title="Use These Anchors",
                items=matched_skills or ["Pick one project, one internship task, and one debugging story you can explain confidently."],
            ),
        ]
        next_steps = [
            "Prepare 3 project stories using situation, action, and result.",
            "Practice one technical answer aloud and add a metric or tradeoff.",
            "Review the core concepts most closely tied to your target role.",
        ]
        follow_ups = [
            "Give me a 1-week interview preparation plan.",
            "Help me answer project-based interview questions.",
            "What mistakes should I avoid in technical interviews?",
        ]
    else:
        answer_title = "Placement Guidance"
        answer = (
            "The fastest improvement comes from aligning your resume, skill-building, and interview practice around one clear target role. "
            "Keep your next steps specific, measurable, and tied to real proof of work."
        )
        sections = [
            ChatResponseSection(
                title="Current Signals",
                items=matched_skills or ["Use your strongest project, tools, and internship signals as the center of your preparation."],
            ),
            ChatResponseSection(
                title="Priority Fixes",
                items=missing_skills or resume_suggestions or ["Improve role alignment, quantified bullets, and project storytelling."],
            ),
        ]
        next_steps = unique_text_items(
            [
                *resume_suggestions,
                "Choose one target role and align your preparation plan to it.",
                "Refresh one strong project explanation with measurable impact.",
            ]
        )[:3]
        follow_ups = [
            "What should I improve first in my profile?",
            "How do I prepare for placements this week?",
            "Which skills should I focus on next?",
        ]

    suggestions = unique_text_items([*next_steps, *resume_suggestions])[:4]
    return {
        "answer_title": answer_title,
        "answer": clean_chatbot_response(answer),
        "sections": sections[:3],
        "next_steps": next_steps[:3],
        "follow_up_questions": follow_ups[:3],
        "suggestions": suggestions,
    }


def ask_ai(
    *,
    question: str,
    history: list,
    context: ChatContext | None,
    grounded_context: str,
    intent: str,
    jobs: list,
    gap_analysis,
) -> dict:
    client, model_name = get_client()
    history_text = _serialize_history(history)
    student_profile = _student_profile_summary(context)
    active_job = _active_job_summary(context)
    resume_analysis = _resume_analysis_summary(context)
    recommendation_context = _recommendation_summary(context)
    gap_summary = (
        f"Matched skills: {join_list_values(gap_analysis.matched_skills[:6], 'None yet')}\n"
        f"Missing skills: {join_list_values(gap_analysis.missing_skills[:6], 'None identified')}\n"
        f"Gap percent: {gap_analysis.skill_gap_percent}%"
        if gap_analysis
        else "No active skill-gap analysis available."
    )

    prompt = f"""
Return only valid JSON.

You are an advanced AI placement mentor inside a real student placement platform.
Answer the user's question with practical, resume-aware guidance in a polished and structured way.

User question:
{question}

Detected intent:
{intent}

Conversation history:
{history_text}

Student profile:
{student_profile}

Active job context:
{active_job}

Resume analysis:
{resume_analysis}

Skill gap summary:
{gap_summary}

Grounded knowledge:
{grounded_context or "No extra retrieval context available."}

Job recommendation context:
{recommendation_context}

Rules:
- Sound like a mentor helping a student prepare for placements.
- Start with a direct answer in 2 to 4 sentences.
- Keep the response specific, practical, and realistic.
- Use only the context provided. If something is uncertain, say "based on the information shared".
- For resume questions, prioritize bullet quality, ATS fit, missing signals, and project framing.
- For interview questions, prioritize structure, ownership, tradeoffs, validation, and communication.
- For jobs questions, explain role fit and next steps without inventing openings beyond the supplied recommendations.
- Do not sound robotic, repetitive, or generic.
- Do not mention JSON or being an AI model.
- Avoid markdown tables.

JSON shape:
{{
  "answer_title": "short heading",
  "answer": "2 to 4 sentence direct answer",
  "sections": [
    {{
      "title": "string",
      "items": ["string", "string", "string"]
    }}
  ],
  "next_steps": ["string", "string", "string"],
  "follow_up_questions": ["string", "string", "string"],
  "matched_topics": ["string", "string", "string"],
  "suggestions": ["string", "string", "string"]
}}
""".strip()

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=(
                "You are a structured placement mentor. "
                "Return strict JSON with a concise direct answer, practical sections, next steps, and follow-up prompts."
            ),
            temperature=0.68,
            top_p=0.92,
            max_output_tokens=1500,
            response_mime_type="application/json",
        ),
    )

    return _extract_response_payload(response)


def generate_chat_response(
    question: str,
    history,
    registry: ModelRegistry,
    context: ChatContext | None = None,
    resume_skills: list[str] | None = None,
    top_k: int = 3,
) -> ChatResponse:
    question = normalize_spaces(question)
    history_items = list(history or [])

    if is_greeting_message(question):
        return ChatResponse(
            answer="Hi! I’m your AI placement assistant. Ask about resumes, interviews, skills, or job fit, and I’ll help you with focused next steps.",
            answer_title="Placement Assistant",
            intent="general",
            suggestions=[
                "Review my resume gaps",
                "Give me a 1-week interview plan",
                "Which roles fit my profile best?",
            ],
            sections=[
                ChatResponseSection(
                    title="What I Can Help With",
                    items=[
                        "Resume improvement and ATS alignment",
                        "Skill-gap planning for your target role",
                        "Interview preparation, answers, and follow-ups",
                    ],
                )
            ],
            next_steps=[
                "Pick one target role before we optimize your resume.",
                "Ask for a weekly plan if you want a practical routine.",
                "Share a job target to make the advice more specific.",
            ],
            follow_up_questions=[
                "What should I improve first in my resume?",
                "How do I prepare for interviews this week?",
                "Which roles fit my current profile?",
            ],
            confidence=0.95,
            jobs=[],
            matched_topics=["placements", "resume", "interview"],
            fallback_used=False,
            answer_mode="greeting",
            context_flags={"intent": "general", "resumeAware": False, "jobAware": False},
        )

    intent_data = detect_intent(question, history_items, context)
    intent = intent_data.get("intent", "general")
    use_context = intent in ["resume", "jobs", "interview", "skills"]

    jobs = []
    grounded_context = ""
    gap_analysis = None

    if use_context:
        sections = retrieve_relevant_sections(
            question, [item.content if hasattr(item, "content") else str(item) for item in history_items], registry, intent=intent, top_k=top_k
        )
        grounded_context = build_grounded_context(sections)

        if intent == "jobs":
            jobs = build_chat_job_suggestions(
                context.recommended_jobs if context else [],
                context.external_jobs if context else [],
                max_items=3,
            )

        if context and context.active_job:
            gap_analysis = analyze_skill_gap_from_skills(
                resume_skills or [],
                context.active_job.skills,
                "",
            )

    try:
        payload = ask_ai(
            question=question,
            history=history_items,
            context=context,
            grounded_context=grounded_context,
            intent=intent,
            jobs=jobs,
            gap_analysis=gap_analysis,
        )
        answer = clean_chatbot_response(payload.get("answer", ""))
        sections = _coerce_sections(payload.get("sections", []))

        if not answer:
            raise ValueError("Missing chatbot answer")

        return ChatResponse(
            answer=answer,
            answer_title=normalize_spaces(payload.get("answer_title", "")) or "Placement Guidance",
            intent=intent,
            suggestions=_coerce_text_list(payload.get("suggestions", [])),
            confidence=float(intent_data.get("confidence", 0.82) or 0.82),
            jobs=jobs if intent == "jobs" else [],
            matched_topics=unique_text_items(
                [
                    *_coerce_text_list(payload.get("matched_topics", []), limit=5),
                    *_match_topics(intent_data, context, jobs),
                ]
            )[:5],
            sections=sections,
            next_steps=_coerce_text_list(payload.get("next_steps", []), limit=4),
            follow_up_questions=_coerce_text_list(payload.get("follow_up_questions", []), limit=3),
            fallback_used=False,
            answer_mode="ai-structured",
            context_flags={
                "intent": intent,
                "resumeAware": bool(context and context.resume_analysis),
                "jobAware": bool(context and context.active_job and normalize_spaces(context.active_job.job_title)),
                "usedGroundedContext": bool(grounded_context),
                "usedSkillGap": bool(gap_analysis),
            },
            skill_gap=gap_analysis,
        )
    except Exception:
        fallback = _fallback_chat_payload(
            question=question,
            intent=intent,
            context=context,
            jobs=jobs,
            gap_analysis=gap_analysis,
        )
        return ChatResponse(
            answer=fallback["answer"],
            answer_title=fallback["answer_title"],
            intent=intent,
            suggestions=fallback["suggestions"],
            confidence=float(intent_data.get("confidence", 0.72) or 0.72),
            jobs=jobs if intent == "jobs" else [],
            matched_topics=_match_topics(intent_data, context, jobs),
            sections=fallback["sections"],
            next_steps=fallback["next_steps"],
            follow_up_questions=fallback["follow_up_questions"],
            fallback_used=True,
            answer_mode="fallback-structured",
            context_flags={
                "intent": intent,
                "resumeAware": bool(context and context.resume_analysis),
                "jobAware": bool(context and context.active_job and normalize_spaces(context.active_job.job_title)),
                "usedGroundedContext": bool(grounded_context),
                "usedSkillGap": bool(gap_analysis),
            },
            skill_gap=gap_analysis,
        )
