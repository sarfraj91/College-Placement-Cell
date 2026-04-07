from __future__ import annotations

import hashlib
import json
import os
import random
import re
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from models.schemas import (
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    FollowUpRequest,
    FollowUpResponse,
    GenerateAnswerRequest,
    GenerateAnswerResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    InterviewQuestionItem,
)
from utils.text_utils import (
    dedupe_lines,
    join_list_values,
    normalize_spaces,
    strip_markdown_noise,
    unique_text_items,
    word_count,
)


ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
DEFAULT_MODEL = "gemini-2.5-flash"

ROLE_ALIASES = {
    "frontend": "frontend",
    "front end": "frontend",
    "frontend developer": "frontend",
    "backend": "backend",
    "back end": "backend",
    "backend developer": "backend",
    "full stack": "full stack",
    "fullstack": "full stack",
    "full stack developer": "full stack",
}

DIFFICULTY_ALIASES = {
    "easy": "easy",
    "medium": "medium",
    "moderate": "medium",
    "hard": "hard",
    "advanced": "hard",
}

ROLE_CONTEXT = {
    "frontend": {
        "label": "Frontend Developer",
        "scenario": "a student-facing placement dashboard",
        "topics": [
            ("React component architecture", "conceptual"),
            ("state management and API integration", "practical"),
            ("performance debugging and rendering bottlenecks", "debugging"),
            ("accessibility, responsive UI, and UX polish", "practical"),
            ("testing complex user journeys", "practical"),
            ("reusable design systems and Tailwind workflows", "conceptual"),
        ],
        "default_skills": ["react", "javascript", "css", "tailwind css"],
    },
    "backend": {
        "label": "Backend Developer",
        "scenario": "an AI-powered placement platform",
        "topics": [
            ("REST API design and validation", "conceptual"),
            ("database schema decisions and query optimization", "practical"),
            ("authentication, authorization, and data protection", "conceptual"),
            ("debugging latency and production failures", "debugging"),
            ("caching, queues, and scalability tradeoffs", "system-design"),
            ("async job processing and service reliability", "practical"),
        ],
        "default_skills": ["python", "fastapi", "node.js", "sql"],
    },
    "full stack": {
        "label": "Full Stack Developer",
        "scenario": "an end-to-end placement workflow",
        "topics": [
            ("frontend-backend integration and data contracts", "practical"),
            ("designing features across React, APIs, and databases", "system-design"),
            ("debugging issues that span UI, backend, and AI services", "debugging"),
            ("authentication, file uploads, and user workflows", "practical"),
            ("tradeoffs between developer speed, scale, and user experience", "conceptual"),
            ("shipping polished features with testing and monitoring", "system-design"),
        ],
        "default_skills": ["react", "node.js", "fastapi", "sql"],
    },
}

QUESTION_PATTERNS = {
    "easy": [
        "Explain the core idea behind {topic} for {scenario}.",
        "How would you implement {topic} step by step in {scenario}?",
        "What common beginner mistakes happen with {topic}, and how would you avoid them?",
        "If you had to discuss {topic} in an interview, what practical example would you use?",
        "How would your experience with {skill_focus} help you handle {topic}?",
        "Pick one of your projects and explain how {topic} showed up in real work.",
    ],
    "medium": [
        "How would you design {topic} for {scenario} while keeping the code maintainable?",
        "Walk me through a practical implementation of {topic}, including tradeoffs you would consider.",
        "Suppose {topic} causes bugs in production. How would you debug and stabilize it?",
        "Based on your experience with {skill_focus}, what best practices would you follow for {topic}?",
        "Describe how you would explain {topic} using an example from your project work.",
        "If requirements changed midway, how would you adapt your approach to {topic} without slowing delivery?",
    ],
    "hard": [
        "Design a production-ready approach for {topic} in {scenario}. What tradeoffs would you make?",
        "How would you scale or harden {topic} when traffic, complexity, or team size grows quickly?",
        "Imagine your first solution for {topic} failed in production. How would you diagnose the root cause and redesign it?",
        "Using your background in {skill_focus}, what advanced decisions would separate a strong implementation of {topic} from an average one?",
        "How would you justify architectural choices for {topic} to both senior engineers and product stakeholders?",
        "Tell me about a project example where {topic} would require balancing performance, reliability, and developer velocity.",
    ],
}


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def get_client() -> genai.Client:
    load_env_file(ENV_PATH)
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    return genai.Client(api_key=api_key)


def _normalize_role(value: str | None) -> str:
    lowered = normalize_spaces(value).lower()
    return ROLE_ALIASES.get(lowered, "full stack")


def _normalize_difficulty(value: str | None) -> str:
    lowered = normalize_spaces(value).lower()
    return DIFFICULTY_ALIASES.get(lowered, "medium")


def _profile_skills(skills: list[str], resume_skills: list[str], role: str) -> list[str]:
    role_defaults = ROLE_CONTEXT[role]["default_skills"]
    return unique_text_items([*skills, *resume_skills, *role_defaults])[:10]


def _resume_context_summary(resume_summary: str | None, resume_text: str | None) -> str:
    cleaned_summary = normalize_spaces(resume_summary)
    if cleaned_summary:
        return cleaned_summary

    cleaned_text = normalize_spaces(resume_text)
    if not cleaned_text:
        return "Resume details not provided."

    return cleaned_text[:900].rsplit(" ", 1)[0].strip() or cleaned_text[:900]


def _profile_summary(
    skills: list[str],
    projects: str,
    experience: str,
    role: str,
    resume_summary: str | None = "",
    resume_text: str | None = "",
) -> str:
    role_label = ROLE_CONTEXT[role]["label"]
    normalized_projects = normalize_spaces(projects) or "Projects not provided."
    normalized_experience = normalize_spaces(experience) or "Experience not provided."
    normalized_resume = _resume_context_summary(resume_summary, resume_text)
    return normalize_spaces(
        f"Target role: {role_label}. Skills: {join_list_values(skills, 'Core software fundamentals')}. "
        f"Projects: {normalized_projects}. Experience: {normalized_experience}. Resume: {normalized_resume}"
    )


def _extract_json_payload(raw_text: str) -> Any:
    text = str(raw_text or "").strip()
    if not text:
        raise ValueError("Empty model response")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start == -1 or end == -1 or end <= start:
            continue

        candidate = text[start : end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    raise ValueError("Unable to parse JSON payload from model response")


def _extract_response_payload(response: Any) -> Any:
    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        if hasattr(parsed, "model_dump"):
            return parsed.model_dump()
        return parsed

    return _extract_json_payload(getattr(response, "text", "") or "")


def _call_gemini_json(
    *,
    system_instruction: str,
    prompt: str,
    temperature: float,
    max_output_tokens: int,
) -> Any:
    model_name = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    client = get_client()
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            systemInstruction=system_instruction,
            temperature=temperature,
            topP=0.95,
            maxOutputTokens=max_output_tokens,
            responseMimeType="application/json",
            seed=random.randint(1, 999_999),
        ),
    )
    return _extract_response_payload(response)


def _question_id(question: str) -> str:
    digest = hashlib.md5(question.encode("utf-8")).hexdigest()
    return digest[:12]


def _coerce_question_items(payload: Any) -> list[dict[str, str]]:
    if isinstance(payload, dict):
        raw_items = payload.get("questions", [])
    elif isinstance(payload, list):
        raw_items = payload
    else:
        raw_items = []

    items: list[dict[str, str]] = []
    for entry in raw_items:
        if isinstance(entry, str):
            items.append({"question": entry})
            continue

        if isinstance(entry, dict):
            items.append(entry)

    return items


def _fallback_questions(
    data: GenerateQuestionsRequest,
    role: str,
    difficulty: str,
    skills: list[str],
) -> list[InterviewQuestionItem]:
    context = ROLE_CONTEXT[role]
    patterns = QUESTION_PATTERNS[difficulty]
    scenario = context["scenario"]
    skill_focus = join_list_values(skills[:3], "core software skills")
    project_hint = normalize_spaces(data.projects)
    topics = context["topics"]
    excluded = {normalize_spaces(item).lower() for item in data.exclude_questions}
    questions: list[InterviewQuestionItem] = []
    seen = set(excluded)

    for index, (topic, question_type) in enumerate(topics):
        template = patterns[index % len(patterns)]
        question = normalize_spaces(
            template.format(
                topic=topic,
                scenario=scenario,
                skill_focus=skill_focus,
            )
        )

        if "project" in question.lower() and not project_hint:
            question = normalize_spaces(
                f"How would you explain a practical example of {topic} from work that resembles {scenario}?"
            )

        normalized = question.lower()
        if normalized in seen:
            continue

        seen.add(normalized)
        questions.append(
            InterviewQuestionItem(
                id=_question_id(question),
                question=question,
                focus_area=topic,
                question_type=question_type,
                difficulty=difficulty,
                role=role,
                personalization=(
                    f"Links the interview topic to your background in {skill_focus}."
                    if skill_focus
                    else "Selected to match your target role."
                ),
            )
        )

        if len(questions) >= data.count:
            break

    return questions[: data.count]


def _normalize_questions(
    payload: Any,
    data: GenerateQuestionsRequest,
    role: str,
    difficulty: str,
    skills: list[str],
) -> list[InterviewQuestionItem]:
    excluded = {normalize_spaces(item).lower() for item in data.exclude_questions}
    seen = set(excluded)
    questions: list[InterviewQuestionItem] = []

    for item in _coerce_question_items(payload):
        question = normalize_spaces(item.get("question", ""))
        if not question:
            continue

        normalized = question.lower()
        if normalized in seen:
            continue

        seen.add(normalized)
        questions.append(
            InterviewQuestionItem(
                id=_question_id(question),
                question=question,
                focus_area=normalize_spaces(item.get("focus_area", "")),
                question_type=normalize_spaces(item.get("question_type", "")),
                difficulty=_normalize_difficulty(item.get("difficulty", difficulty)),
                role=_normalize_role(item.get("role", role)),
                personalization=normalize_spaces(item.get("personalization", "")),
            )
        )

        if len(questions) >= data.count:
            break

    if len(questions) < data.count:
        fallback_items = _fallback_questions(data, role, difficulty, skills)
        for item in fallback_items:
            if item.question.lower() in seen:
                continue
            seen.add(item.question.lower())
            questions.append(item)
            if len(questions) >= data.count:
                break

    return questions[: data.count]


def _answer_fallback(data: GenerateAnswerRequest, role: str, difficulty: str, skills: list[str]) -> GenerateAnswerResponse:
    role_label = ROLE_CONTEXT[role]["label"]
    example_hint = normalize_spaces(data.projects) or "a recent academic or personal project"
    answer = (
        f"I would answer this by first clarifying the goal, the constraints, and the tradeoffs that matter most for a {role_label} role. "
        f"Then I would describe the practical implementation steps, using {join_list_values(skills[:4], 'relevant tools and fundamentals')} where appropriate. "
        f"To keep the answer grounded, I would connect it to {example_hint} and explain what decisions I made, why I made them, and how I validated the result. "
        f"I would close by mentioning testing, edge cases, and one tradeoff I would revisit if the requirements or scale changed."
    )

    if difficulty == "hard":
        answer = (
            f"For a harder version of this question, I would frame my answer around architecture, scale, and tradeoffs. "
            f"I would start with the business goal, define the system boundaries, and explain why I would choose a particular approach based on maintainability, reliability, and performance. "
            f"Next, I would walk through an implementation example that uses {join_list_values(skills[:4], 'role-relevant technologies')} and connect it to {example_hint}. "
            f"Finally, I would discuss failure scenarios, monitoring, and how I would iterate if production feedback exposed bottlenecks."
        )

    return GenerateAnswerResponse(
        answer=strip_markdown_noise(answer),
        highlights=dedupe_lines(
            [
                "Open with the problem, constraints, and success criteria.",
                "Use a concrete example from your projects or internships.",
                "Call out testing, tradeoffs, and measurable impact.",
            ]
        ),
        answer_framework=dedupe_lines(
            [
                "State the goal clearly.",
                "Explain the implementation approach.",
                "Share a project example.",
                "Close with tradeoffs and validation.",
            ]
        ),
        fallback_used=True,
    )


def _feedback_fallback(data: EvaluateAnswerRequest, role: str) -> EvaluateAnswerResponse:
    answer_text = strip_markdown_noise(data.user_answer)
    strengths: list[str] = []
    weaknesses: list[str] = []

    if word_count(answer_text) >= 60:
        strengths.append("Your answer has enough detail to sound thoughtful rather than rushed.")
    else:
        weaknesses.append("Your answer is too short, so it may sound underdeveloped in a real interview.")

    if re.search(r"\b(i|my|we)\b", answer_text, flags=re.IGNORECASE):
        strengths.append("You use personal ownership language, which helps the answer feel authentic.")
    else:
        weaknesses.append("Add first-person ownership so the interviewer understands what you personally did.")

    if re.search(r"\b(example|project|built|used|implemented)\b", answer_text, flags=re.IGNORECASE):
        strengths.append("You reference practical work, which makes the answer more believable.")
    else:
        weaknesses.append("Include a concrete project or implementation example to support your explanation.")

    if re.search(r"\b(because|tradeoff|impact|result|performance|latency|scale)\b", answer_text, flags=re.IGNORECASE):
        strengths.append("You hint at reasoning and tradeoffs, which interviewers usually value.")
    else:
        weaknesses.append("Add reasoning, impact, or tradeoff language so the answer sounds more senior.")

    strengths = strengths[:3] or ["Your answer touches the topic directly, which is a good starting point."]
    weaknesses = weaknesses[:3] or ["Improve structure slightly so the answer flows from problem to implementation to outcome."]

    improved_answer = (
        f"A stronger {ROLE_CONTEXT[role]['label']} answer would start by stating the goal and constraints clearly, "
        f"then explain the implementation approach in steps, and finally tie it to a real project outcome. "
        f"For this question, I would say what I built, why I chose that approach, how I validated it, and what tradeoff I would revisit if the system grew more complex."
    )

    score = 72
    if word_count(answer_text) < 40:
        score = 48
    elif word_count(answer_text) > 110 and len(strengths) >= 3:
        score = 82

    verdict = (
        "Promising answer with clear room to become more specific and example-driven."
        if score < 80
        else "Strong answer that sounds practical and interview-ready."
    )

    return EvaluateAnswerResponse(
        strengths=dedupe_lines(strengths),
        weaknesses=dedupe_lines(weaknesses),
        improved_answer=strip_markdown_noise(improved_answer),
        verdict=verdict,
        score=score,
        fallback_used=True,
    )


def _follow_up_fallback(data: FollowUpRequest, role: str) -> FollowUpResponse:
    question_text = normalize_spaces(data.question).lower()

    if role == "frontend" or any(
        marker in question_text for marker in ("react", "ui", "frontend", "accessibility")
    ):
        follow_up_question = (
            "How would you measure whether that frontend decision actually improved performance, accessibility, and user experience in production?"
        )
        reason = "Pushes deeper on validation, metrics, and real-world frontend tradeoffs."
    elif role == "backend" or any(
        marker in question_text for marker in ("api", "database", "backend", "cache", "latency")
    ):
        follow_up_question = (
            "If traffic increased 10x after launch, what would you change first in the API, database, and monitoring strategy?"
        )
        reason = "Explores scale, reliability, and operational thinking."
    else:
        follow_up_question = (
            "What tradeoff would you revisit first if this solution had to support more users, faster iteration, and stricter reliability requirements?"
        )
        reason = "Moves the discussion from implementation to senior-level tradeoff thinking."

    return FollowUpResponse(
        follow_up_question=follow_up_question,
        reason=reason,
        fallback_used=True,
    )


def generate_interview_questions(data: GenerateQuestionsRequest) -> GenerateQuestionsResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
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

Generate exactly {data.count} distinct interview questions for a student targeting a {ROLE_CONTEXT[role]['label']} role.

Student profile:
- Skills: {join_list_values(skills, 'Core software fundamentals')}
- Projects: {normalize_spaces(data.projects) or 'Not provided'}
- Experience: {normalize_spaces(data.experience) or 'Not provided'}
- Resume context: {resume_context}
- Target role: {ROLE_CONTEXT[role]['label']}
- Difficulty: {difficulty}

Do not repeat or closely paraphrase any of these questions:
{json.dumps(unique_text_items(data.exclude_questions), ensure_ascii=True)}

Rules:
- Mix conceptual and practical questions.
- Make them realistic for interviews, not textbook trivia.
- Personalize questions to the student's profile when possible.
- Keep each question focused and concise.

JSON shape:
{{
  "questions": [
    {{
      "question": "string",
      "focus_area": "string",
      "question_type": "conceptual|practical|debugging|system-design|behavioral",
      "difficulty": "{difficulty}",
      "role": "{role}",
      "personalization": "one short sentence"
    }}
  ]
}}
""".strip()

    fallback_used = False
    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior interviewer generating practical, personalized software interview questions. "
                "Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.9,
            max_output_tokens=1800,
        )
        questions = _normalize_questions(payload, data, role, difficulty, skills)
    except Exception:
        fallback_used = True
        questions = _fallback_questions(data, role, difficulty, skills)

    return GenerateQuestionsResponse(
        questions=questions,
        role=role,
        difficulty=difficulty,
        profile_summary=profile_summary,
        fallback_used=fallback_used,
    )


def generate_interview_answer(data: GenerateAnswerRequest) -> GenerateAnswerResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    skills = _profile_skills(data.skills, data.resume_skills, role)
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

Write a strong interview answer for this question:
{data.question}

Student profile:
- {profile_summary}
- Previous answers to avoid repeating: {json.dumps(unique_text_items(data.previous_answers), ensure_ascii=True)}
- Difficulty target: {difficulty}

Rules:
- Make the answer practical and structured.
- Use an example-oriented explanation style.
- Sound like a strong candidate, not a textbook.
- Keep the answer around 180 to 260 words.
- Do not repeat previous answers closely.

JSON shape:
{{
  "answer": "string",
  "highlights": ["string", "string", "string"],
  "answer_framework": ["string", "string", "string", "string"]
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior software interviewer and mentor. "
                "Create strong, practical model answers for student interviews. Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.92,
            max_output_tokens=1400,
        )
        answer = strip_markdown_noise(payload.get("answer", "")) if isinstance(payload, dict) else ""
        highlights = unique_text_items(payload.get("highlights", [])) if isinstance(payload, dict) else []
        framework = unique_text_items(payload.get("answer_framework", [])) if isinstance(payload, dict) else []

        if not answer or word_count(answer) < 45:
            raise ValueError("Generated answer was too short")

        return GenerateAnswerResponse(
            answer=answer,
            highlights=highlights[:4],
            answer_framework=framework[:5],
            fallback_used=False,
        )
    except Exception:
        return _answer_fallback(data, role, difficulty, skills)


def evaluate_interview_answer(data: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)

    prompt = f"""
Return only valid JSON.

Evaluate this student interview answer like a real interviewer.

Question:
{data.question}

Student answer:
{data.user_answer}

Target role: {ROLE_CONTEXT[role]['label']}
Difficulty: {difficulty}

Rules:
- Be constructive, practical, and specific.
- Mention strengths and weaknesses separately.
- Write an improved answer that sounds polished but believable.
- Give a score from 0 to 100.

JSON shape:
{{
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string", "string"],
  "improved_answer": "string",
  "verdict": "string",
  "score": 0
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior interviewer giving honest, practical answer feedback. Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.65,
            max_output_tokens=1500,
        )
        strengths = unique_text_items(payload.get("strengths", [])) if isinstance(payload, dict) else []
        weaknesses = unique_text_items(payload.get("weaknesses", [])) if isinstance(payload, dict) else []
        improved_answer = (
            strip_markdown_noise(payload.get("improved_answer", "")) if isinstance(payload, dict) else ""
        )
        verdict = normalize_spaces(payload.get("verdict", "")) if isinstance(payload, dict) else ""
        score = payload.get("score", 0) if isinstance(payload, dict) else 0
        score = max(0, min(100, int(score or 0)))

        if not improved_answer:
            raise ValueError("Missing improved answer")

        return EvaluateAnswerResponse(
            strengths=strengths[:4],
            weaknesses=weaknesses[:4],
            improved_answer=improved_answer,
            verdict=verdict,
            score=score,
            fallback_used=False,
        )
    except Exception:
        return _feedback_fallback(data, role)


def generate_follow_up_question(data: FollowUpRequest) -> FollowUpResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)

    prompt = f"""
Return only valid JSON.

Generate one deeper follow-up interview question based on this exchange.

Original question:
{data.question}

Student answer:
{data.user_answer}

Target role: {ROLE_CONTEXT[role]['label']}
Difficulty: {difficulty}

Rules:
- Ask exactly one follow-up question.
- Make it deeper than the original, not broader.
- Focus on tradeoffs, debugging, scale, or decision-making.

JSON shape:
{{
  "follow_up_question": "string",
  "reason": "one short sentence"
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior interviewer who asks sharp, deeper follow-up questions. Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.88,
            max_output_tokens=500,
        )
        follow_up_question = (
            normalize_spaces(payload.get("follow_up_question", "")) if isinstance(payload, dict) else ""
        )
        reason = normalize_spaces(payload.get("reason", "")) if isinstance(payload, dict) else ""

        if not follow_up_question:
            raise ValueError("Missing follow-up question")

        return FollowUpResponse(
            follow_up_question=follow_up_question,
            reason=reason,
            fallback_used=False,
        )
    except Exception:
        return _follow_up_fallback(data, role)
