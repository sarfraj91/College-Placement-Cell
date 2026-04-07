from __future__ import annotations

import os
from pathlib import Path
from google import genai

from models.schemas import ChatContext, ChatResponse
from services.intent_service import detect_intent, is_greeting_message
from services.job_service import build_chat_job_suggestions
from services.embedding_service import analyze_skill_gap_from_skills
from services.model_loder import ModelRegistry
from services.rag_service import build_grounded_context, retrieve_relevant_sections
from utils.text_utils import normalize_spaces, unique_text_items


ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
DEFAULT_MODEL = "gemini-2.5-flash"


# ---------------- GEMINI ----------------

def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def get_client():
    load_env_file(ENV_PATH)
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    return genai.Client(api_key=api_key)


def ask_ai(question: str, context: str, intent: str, use_context: bool):
    client = get_client()

    prompt = f"""
You are an advanced AI Placement Assistant.

User Question:
{question}

Context:
{context}

Intent:
{intent}

-----------------------

STRICT RULES:

1. If question is GENERAL → answer normally (ignore placement context)

2. If question is about RESUME:
   - Give specific improvements
   - Rewrite examples
   - Avoid generic advice

3. If question is about JOBS:
   - Suggest roles ONLY if asked
   - Be realistic and relevant

4. NEVER:
   - Repeat same template
   - Always suggest jobs
   - Give generic answers

5. Answer like a mentor, not a bot

-----------------------

Final Answer:
"""

    res = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=prompt
    )

    return str(res.text).strip()


# ---------------- MAIN ----------------

def generate_chat_response(
    question: str,
    history,
    registry: ModelRegistry,
    context: ChatContext | None = None,
    resume_skills: list[str] | None = None,
    top_k: int = 3,
) -> ChatResponse:

    question = normalize_spaces(question)
    history_text = [
        item.content if hasattr(item, "content") else str(item)
        for item in (history or [])
    ]

    if is_greeting_message(question):
        return ChatResponse(
            answer="Hi! I’m your AI placement assistant 🚀",
            intent="general",
            suggestions=[],
            confidence=0.9,
            jobs=[],
            matched_topics=[],
            fallback_used=False,
            answer_mode="greeting",
            context_flags={},
        )

    # 🔥 Intent detection
    intent_data = detect_intent(question)
    intent = intent_data.get("intent", "general")

    # 🔥 Decide context usage
    use_context = intent in ["resume", "jobs", "interview", "skills"]

    jobs = []
    grounded_context = ""
    gap_analysis = None

    if use_context:
        sections = retrieve_relevant_sections(
            question, history_text, registry, intent=intent, top_k=top_k
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
                ""
            )

    # 🔥 Build smart context (NOT overloaded)
    context_parts = []

    if grounded_context:
        context_parts.append(grounded_context)

    if gap_analysis:
        context_parts.append(f"Skill Gap: {gap_analysis}")

    context_string = "\n".join(context_parts)

    # 🔥 Ask AI
    answer = ask_ai(question, context_string, intent, use_context)

    return ChatResponse(
        answer=answer,
        intent=intent,
        suggestions=[],
        confidence=0.85,
        jobs=jobs if intent == "jobs" else [],
        matched_topics=[],
        fallback_used=False,
        answer_mode="ai",
        context_flags={"intent": intent},
        skill_gap=gap_analysis,
    )
