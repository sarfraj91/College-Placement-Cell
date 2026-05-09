from __future__ import annotations

import hashlib
import json
import random
import re
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
from services.env_loader import get_gemini_settings
from utils.text_utils import (
    dedupe_lines,
    join_list_values,
    normalize_spaces,
    strip_markdown_noise,
    unique_text_items,
    word_count,
)

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
    "data analyst": "data analyst",
    "analyst": "data analyst",
    "data analytics": "data analyst",
    "data analytics intern": "data analyst",
    "business analyst": "data analyst",
    "bi analyst": "data analyst",
    "business intelligence analyst": "data analyst",
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
    "data analyst": {
        "label": "Data Analyst",
        "scenario": "a reporting and decision-support workflow",
        "topics": [
            ("SQL querying, joins, aggregations, and data validation", "practical"),
            ("data cleaning and preprocessing", "practical"),
            ("dashboard design and KPI storytelling", "practical"),
            ("exploratory data analysis and trend interpretation", "conceptual"),
            ("stakeholder communication and business recommendations", "behavioral"),
            ("experiment analysis, metric tradeoffs, and insight validation", "debugging"),
        ],
        "default_skills": ["sql", "python", "excel", "power bi"],
    },
}

ROLE_SIGNAL_KEYWORDS = {
    "frontend": [
        "frontend",
        "front end",
        "react",
        "next",
        "next.js",
        "javascript",
        "typescript",
        "html",
        "css",
        "tailwind",
        "redux",
        "ui",
        "ux",
        "responsive",
        "accessibility",
    ],
    "backend": [
        "backend",
        "back end",
        "python",
        "fastapi",
        "node",
        "node.js",
        "express",
        "django",
        "flask",
        "java",
        "spring",
        "api",
        "rest",
        "graphql",
        "sql",
        "postgres",
        "mysql",
        "mongodb",
        "redis",
        "jwt",
        "microservice",
    ],
    "data analyst": [
        "data analyst",
        "analytics",
        "analysis",
        "analyst",
        "business intelligence",
        "power bi",
        "tableau",
        "excel",
        "spreadsheet",
        "sql",
        "postgres",
        "mysql",
        "bigquery",
        "snowflake",
        "python",
        "pandas",
        "numpy",
        "statistics",
        "statistical",
        "hypothesis",
        "a/b testing",
        "ab testing",
        "dashboard",
        "visualization",
        "reporting",
        "kpi",
        "metric",
        "etl",
        "data cleaning",
        "data preprocessing",
    ],
}

RESUME_TOPIC_HINTS = [
    {
        "pattern": re.compile(r"power\s*bi|tableau|dashboard|visuali[sz]ation|looker", re.IGNORECASE),
        "topic": ("dashboard design, KPI storytelling, and visual communication", "practical"),
    },
    {
        "pattern": re.compile(r"sql|mysql|postgres|bigquery|snowflake|query|join|cte", re.IGNORECASE),
        "topic": ("SQL querying, aggregations, joins, and data validation", "practical"),
    },
    {
        "pattern": re.compile(r"python|pandas|numpy|jupyter", re.IGNORECASE),
        "topic": ("Python-based data cleaning, preprocessing, and analysis", "practical"),
    },
    {
        "pattern": re.compile(r"excel|pivot|vlookup|xlookup", re.IGNORECASE),
        "topic": ("Excel-driven analysis, cleaning, and reporting", "practical"),
    },
    {
        "pattern": re.compile(r"statistics|hypothesis|regression|correlation|significance|a\/b|ab test", re.IGNORECASE),
        "topic": ("statistical reasoning, experiment analysis, and interpreting significance", "conceptual"),
    },
    {
        "pattern": re.compile(r"etl|pipeline|warehouse|data quality|ingestion", re.IGNORECASE),
        "topic": ("data pipelines, ETL workflows, and quality checks", "system-design"),
    },
    {
        "pattern": re.compile(r"stakeholder|business|recommendation|insight|kpi|metric", re.IGNORECASE),
        "topic": ("translating analysis into business recommendations and KPI decisions", "behavioral"),
    },
    {
        "pattern": re.compile(r"react|next|ui|ux|tailwind|css", re.IGNORECASE),
        "topic": ("building responsive UI flows and reusable components", "practical"),
    },
    {
        "pattern": re.compile(r"node|express|django|flask|api|rest|graphql", re.IGNORECASE),
        "topic": ("API design, integration, and debugging service flows", "practical"),
    },
]

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

DIFFICULTY_GUIDANCE = {
    "easy": "Emphasize fundamentals, simple implementation steps, and clear resume-backed examples.",
    "medium": "Emphasize practical tradeoffs, debugging logic, maintainability, and execution details.",
    "hard": "Emphasize architecture, scale, failure handling, deep tradeoffs, and stronger technical justification.",
}

ANCHOR_STOPWORDS = {
    "about",
    "after",
    "along",
    "also",
    "because",
    "before",
    "during",
    "from",
    "into",
    "that",
    "them",
    "then",
    "there",
    "this",
    "using",
    "with",
    "your",
}
def get_client() -> genai.Client:
    api_key, _ = get_gemini_settings(DEFAULT_MODEL)
    return genai.Client(api_key=api_key)


def _normalize_role(value: str | None) -> str:
    lowered = normalize_spaces(value).lower()
    return ROLE_ALIASES.get(lowered, "full stack")


def _normalize_difficulty(value: str | None) -> str:
    lowered = normalize_spaces(value).lower()
    return DIFFICULTY_ALIASES.get(lowered, "medium")


def _skill_topic(skill: str) -> tuple[str, str] | None:
    normalized_skill = normalize_spaces(skill)
    lowered = normalized_skill.lower()

    if not lowered:
        return None

    if re.search(r"power\s*bi|tableau|looker", lowered):
        return (f"using {normalized_skill} to design dashboards and explain KPIs", "practical")

    if re.search(r"sql|mysql|postgres|bigquery|snowflake", lowered):
        return (f"using {normalized_skill} for querying, joins, and data validation", "practical")

    if re.search(r"python|pandas|numpy|jupyter", lowered):
        return (f"using {normalized_skill} for data cleaning and analysis", "practical")

    if re.search(r"excel|spreadsheet|pivot", lowered):
        return (f"using {normalized_skill} for reporting, cleaning, and ad hoc analysis", "practical")

    if re.search(r"statistics|regression|correlation|hypothesis|a\/b", lowered):
        return (f"applying {normalized_skill} to make reliable data decisions", "conceptual")

    if re.search(r"react|next|tailwind|typescript|javascript", lowered):
        return (f"applying {normalized_skill} to build polished user experiences", "practical")

    if re.search(r"node|express|django|flask|fastapi|api", lowered):
        return (f"applying {normalized_skill} to build and debug backend workflows", "practical")

    return None


def _profile_skills(skills: list[str], resume_skills: list[str], role: str) -> list[str]:
    role_defaults = ROLE_CONTEXT[role]["default_skills"]
    return unique_text_items([*skills, *resume_skills, *role_defaults])[:10]


def _resume_topic_pool(
    role: str,
    skills: list[str],
    data: GenerateQuestionsRequest | GenerateAnswerRequest | EvaluateAnswerRequest | FollowUpRequest,
) -> list[tuple[str, str]]:
    context_topics = ROLE_CONTEXT[role]["topics"]
    text_corpus = normalize_spaces(
        " ".join(
            [
                normalize_spaces(data.projects or ""),
                normalize_spaces(data.experience or ""),
                normalize_spaces(data.resume_summary or ""),
                normalize_spaces((data.resume_text or "")[:2800]),
            ]
        )
    )

    hinted_topics = [
        entry["topic"]
        for entry in RESUME_TOPIC_HINTS
        if entry["pattern"].search(text_corpus)
    ]
    skill_topics = [topic for item in skills if (topic := _skill_topic(item))]

    deduped: list[tuple[str, str]] = []
    seen = set()
    for topic, question_type in [*hinted_topics, *skill_topics, *context_topics]:
        normalized = normalize_spaces(topic).lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append((normalize_spaces(topic), question_type or "conceptual"))

    return deduped[:12]


def _resume_anchor_points(
    role: str,
    skills: list[str],
    data: GenerateQuestionsRequest,
) -> list[str]:
    topic_labels = [topic for topic, _ in _resume_topic_pool(role, skills, data)[:8]]
    project_hint = normalize_spaces(data.projects or "")
    experience_hint = normalize_spaces(data.experience or "")
    anchors = unique_text_items(
        [
            *skills[:6],
            *topic_labels,
            project_hint[:180] if project_hint else "",
            experience_hint[:180] if experience_hint else "",
        ]
    )
    return anchors[:10]


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

    def _parse_candidate(candidate_text: str) -> Any:
        normalized = str(candidate_text or "").strip()
        if not normalized:
            raise ValueError("Empty JSON candidate")

        candidate_variants = [
            normalized,
            normalized
            .replace("\u201c", '"')
            .replace("\u201d", '"')
            .replace("\u2018", "'")
            .replace("\u2019", "'"),
        ]

        repaired_variants = [
            re.sub(r",(?=\s*[}\]])", "", variant)
            for variant in candidate_variants
        ]
        candidate_variants.extend(repaired_variants)

        seen_variants: set[str] = set()
        for variant in candidate_variants:
            cleaned_variant = variant.strip()
            if not cleaned_variant or cleaned_variant in seen_variants:
                continue

            seen_variants.add(cleaned_variant)
            try:
                return json.loads(cleaned_variant)
            except json.JSONDecodeError:
                continue

        raise ValueError("Unable to parse JSON candidate")

    try:
        return _parse_candidate(text)
    except ValueError:
        pass

    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start == -1 or end == -1 or end <= start:
            continue

        candidate = text[start : end + 1]
        try:
            return _parse_candidate(candidate)
        except ValueError:
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
    _, model_name = get_gemini_settings(DEFAULT_MODEL)
    client = get_client()
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            top_p=0.95,
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json",
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


def _coerce_text_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return unique_text_items([str(item) for item in value])

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []

        if text.startswith("["):
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return unique_text_items([str(item) for item in parsed])
            except json.JSONDecodeError:
                pass

        return dedupe_lines(re.split(r"[\n,;|]+", text))

    return []


def _role_label(role: str) -> str:
    return ROLE_CONTEXT[role]["label"]


def _question_support_bundle(
    *,
    role: str,
    focus_area: str = "",
    question_type: str = "",
    personalization: str = "",
    skills: list[str] | None = None,
) -> dict[str, Any]:
    focus_hint = normalize_spaces(focus_area) or "your experience"
    type_hint = normalize_spaces(question_type).lower()
    skill_focus = join_list_values((skills or [])[:3], "your strongest recent work")
    role_label = _role_label(role)

    if type_hint == "behavioral":
        interviewer_intent = (
            f"Checks how clearly you communicate ownership, judgment, and outcomes around {focus_hint} for a {role_label} role."
        )
        strong_signals = [
            "Use a compact STAR flow with clear ownership.",
            "Mention a real challenge, decision, and result.",
            "Close with what changed or what you learned.",
        ]
        red_flags = [
            "Giving a team story without saying what you personally owned.",
            "Staying generic instead of using a real example.",
            "Ending without a result, learning, or impact.",
        ]
    elif type_hint == "debugging":
        interviewer_intent = (
            f"Tests how you break down issues, verify root causes, and recover from failures in {focus_hint}."
        )
        strong_signals = [
            "Explain the symptom, root-cause path, and fix.",
            "Mention the data, logs, or checks you used.",
            "Show how you prevented the issue from repeating.",
        ]
        red_flags = [
            "Jumping to the fix without showing diagnosis.",
            "Giving a theoretical answer with no real incident.",
            "Skipping validation after the fix.",
        ]
    elif type_hint == "system-design":
        interviewer_intent = (
            f"Explores how well you reason about architecture, tradeoffs, and scale in {focus_hint}."
        )
        strong_signals = [
            "Start with goal, constraints, and key components.",
            "Call out tradeoffs in performance, reliability, and maintainability.",
            "Mention how you would validate or monitor the design.",
        ]
        red_flags = [
            "Listing tools without explaining why they fit.",
            "Skipping tradeoffs or failure cases.",
            "Sounding too broad for the actual resume context.",
        ]
    else:
        interviewer_intent = (
            f"Checks whether you can explain {focus_hint} in a practical, resume-grounded way using {skill_focus}."
        )
        strong_signals = [
            "Use one resume-backed example quickly.",
            "Explain one decision and why you made it.",
            "Finish with a result, validation step, or tradeoff.",
        ]
        red_flags = [
            "Giving a textbook answer that ignores your own work.",
            "Listing steps without reasoning or outcomes.",
            "Over-claiming experience the resume does not support.",
        ]

    if personalization:
        strong_signals.append(normalize_spaces(personalization))

    return {
        "interviewer_intent": interviewer_intent,
        "strong_signals": dedupe_lines(strong_signals)[:4],
        "red_flags": dedupe_lines(red_flags)[:4],
    }


def _question_pack_summary(
    *,
    role: str,
    difficulty: str,
    skills: list[str],
    resume_anchors: list[str],
    questions: list[InterviewQuestionItem],
) -> str:
    anchor_hint = resume_anchors[0] if resume_anchors else join_list_values(skills[:3], "your background")
    focus_mix = join_list_values(
        [item.focus_area for item in questions[:3] if normalize_spaces(item.focus_area)],
        "role-relevant questions",
    )
    return normalize_spaces(
        f"This pack targets a {_role_label(role)} interview at {difficulty} difficulty. "
        f"It leans on your background in {anchor_hint} and mixes questions around {focus_mix} so you can practice realistic resume-based conversations."
    )


def _text_tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9][a-z0-9.+#/-]*", normalize_spaces(text).lower())
        if len(token) > 2 and token not in ANCHOR_STOPWORDS
    }


def _resume_anchor_candidates(
    role: str,
    skills: list[str],
    *,
    projects: str = "",
    experience: str = "",
    resume_summary: str = "",
    resume_text: str = "",
) -> list[str]:
    anchor_data = GenerateQuestionsRequest(
        skills=skills,
        projects=projects,
        experience=experience,
        resume_text=resume_text,
        resume_summary=resume_summary,
        resume_skills=skills,
        role=role,
        difficulty="medium",
        count=5,
    )
    return _resume_anchor_points(role, skills, anchor_data)


def _pick_resume_anchor(
    *,
    question: str = "",
    focus_area: str = "",
    anchors: list[str] | None = None,
) -> str:
    cleaned_anchors = [normalize_spaces(item) for item in anchors or [] if normalize_spaces(item)]
    if not cleaned_anchors:
        return ""

    target_tokens = _text_tokens(f"{question} {focus_area}")
    if not target_tokens:
        return cleaned_anchors[0]

    best_anchor = cleaned_anchors[0]
    best_score = -1

    for anchor in cleaned_anchors:
        score = len(target_tokens.intersection(_text_tokens(anchor)))
        if score > best_score:
            best_anchor = anchor
            best_score = score

    return best_anchor


def _fallback_questions(
    data: GenerateQuestionsRequest,
    role: str,
    difficulty: str,
    skills: list[str],
) -> list[InterviewQuestionItem]:
    context = ROLE_CONTEXT[role]
    patterns = QUESTION_PATTERNS[difficulty]
    scenario = context["scenario"]
    skill_focus = join_list_values(skills[:3], "role-relevant skills")
    project_hint = normalize_spaces(data.projects)
    topics = _resume_topic_pool(role, skills, data)
    resume_anchors = _resume_anchor_candidates(
        role,
        skills,
        projects=data.projects or "",
        experience=data.experience or "",
        resume_summary=data.resume_summary or "",
        resume_text=data.resume_text or "",
    )
    excluded = {normalize_spaces(item).lower() for item in data.exclude_questions}
    questions: list[InterviewQuestionItem] = []
    seen = set(excluded)
    template_offset = len(data.exclude_questions) % max(len(patterns), 1)
    rng = random.Random()
    shuffled_topics = topics[:]
    shuffled_patterns = patterns[:]
    rng.shuffle(shuffled_topics)
    rng.shuffle(shuffled_patterns)

    def append_question(topic: str, question_type: str, template: str) -> None:
        if len(questions) >= data.count:
            return

        anchor_focus = _pick_resume_anchor(focus_area=topic, anchors=resume_anchors)
        question_topic = anchor_focus if 0 < word_count(anchor_focus) <= 14 else topic
        question = normalize_spaces(
            template.format(
                topic=question_topic,
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
            return

        seen.add(normalized)
        personalization = (
            f"Pulls from your resume evidence around {anchor_focus}."
            if anchor_focus
            else (
                f"Links the interview topic to your background in {skill_focus}."
                if skill_focus
                else "Selected to match your target role."
            )
        )
        answer_bundle = _build_fallback_answer_bundle(
            question=question,
            role=role,
            difficulty=difficulty,
            skills=skills,
            projects=data.projects or "",
            experience=data.experience or "",
            resume_summary=data.resume_summary or "",
            resume_text=data.resume_text or "",
            focus_area=topic,
            question_type=question_type,
            personalization=personalization,
        )
        support_bundle = _question_support_bundle(
            role=role,
            focus_area=topic,
            question_type=question_type,
            personalization=personalization,
            skills=skills,
        )
        questions.append(
            InterviewQuestionItem(
                id=_question_id(question),
                question=question,
                focus_area=topic,
                question_type=question_type,
                difficulty=difficulty,
                role=role,
                personalization=personalization,
                interviewer_intent=support_bundle["interviewer_intent"],
                strong_signals=support_bundle["strong_signals"],
                red_flags=support_bundle["red_flags"],
                answer=answer_bundle["answer"],
                highlights=answer_bundle["highlights"],
                answer_framework=answer_bundle["answer_framework"],
            )
        )

    for index, (topic, question_type) in enumerate(shuffled_topics):
        template = shuffled_patterns[(index + template_offset) % len(shuffled_patterns)]
        append_question(topic, question_type, template)

        if len(questions) >= data.count:
            break

    if len(questions) < data.count:
        for topic_index, (topic, question_type) in enumerate(shuffled_topics):
            for pattern_index, template in enumerate(shuffled_patterns):
                if len(questions) >= data.count:
                    break

                if pattern_index == (topic_index + template_offset) % len(shuffled_patterns):
                    continue

                append_question(topic, question_type, template)

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
        focus_area = normalize_spaces(item.get("focus_area", item.get("focusArea", "")))
        question_type = normalize_spaces(item.get("question_type", item.get("questionType", "")))
        personalization = normalize_spaces(item.get("personalization", ""))
        raw_answer = strip_markdown_noise(item.get("answer", ""))
        raw_highlights = _coerce_text_list(item.get("highlights", []))
        raw_framework = _coerce_text_list(
            item.get("answer_framework", item.get("answerFramework", [])),
        )
        normalized_role = _normalize_role(item.get("role", role))
        normalized_difficulty = _normalize_difficulty(item.get("difficulty", difficulty))

        if not raw_answer or word_count(raw_answer) < 40:
            answer_bundle = _build_fallback_answer_bundle(
                question=question,
                role=normalized_role,
                difficulty=normalized_difficulty,
                skills=skills,
                projects=data.projects or "",
                experience=data.experience or "",
                resume_summary=data.resume_summary or "",
                resume_text=data.resume_text or "",
                focus_area=focus_area,
                question_type=question_type,
                personalization=personalization,
            )
        else:
            answer_bundle = {
                "answer": raw_answer,
                "highlights": raw_highlights[:4],
                "answer_framework": raw_framework[:5],
            }

        support_bundle = _question_support_bundle(
            role=normalized_role,
            focus_area=focus_area,
            question_type=question_type,
            personalization=personalization,
            skills=skills,
        )

        questions.append(
            InterviewQuestionItem(
                id=_question_id(question),
                question=question,
                focus_area=focus_area,
                question_type=question_type,
                difficulty=normalized_difficulty,
                role=normalized_role,
                personalization=personalization,
                interviewer_intent=normalize_spaces(
                    item.get("interviewer_intent", item.get("interviewerIntent", ""))
                )
                or support_bundle["interviewer_intent"],
                strong_signals=_coerce_text_list(
                    item.get("strong_signals", item.get("strongSignals", []))
                )
                or support_bundle["strong_signals"],
                red_flags=_coerce_text_list(
                    item.get("red_flags", item.get("redFlags", []))
                )
                or support_bundle["red_flags"],
                answer=answer_bundle["answer"],
                highlights=answer_bundle["highlights"],
                answer_framework=answer_bundle["answer_framework"],
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


def _build_fallback_answer_bundle(
    *,
    question: str,
    role: str,
    difficulty: str,
    skills: list[str],
    projects: str = "",
    experience: str = "",
    resume_summary: str = "",
    resume_text: str = "",
    focus_area: str = "",
    question_type: str = "",
    personalization: str = "",
) -> dict[str, Any]:
    role_label = ROLE_CONTEXT[role]["label"]
    resume_anchor = _pick_resume_anchor(
        question=question,
        focus_area=focus_area,
        anchors=_resume_anchor_candidates(
            role,
            skills,
            projects=projects,
            experience=experience,
            resume_summary=resume_summary,
            resume_text=resume_text,
        ),
    )
    example_hint = (
        resume_anchor
        or normalize_spaces(projects)
        or normalize_spaces(experience)
        or _resume_context_summary(resume_summary, resume_text)
        or "a recent academic or personal project"
    )
    focus_hint = normalize_spaces(focus_area) or "this topic"
    question_type_hint = normalize_spaces(question_type).lower()
    skill_focus = join_list_values(skills[:4], "relevant technical fundamentals")
    personalization_hint = normalize_spaces(personalization)
    answer_hook = "Start with the problem or goal, then move quickly into your own contribution."
    delivery_tips = [
        "Keep the answer in first person and make ownership explicit.",
        "Use one real example before moving into theory.",
        "Finish with a result, validation step, or tradeoff.",
    ]
    pitfalls = [
        "Do not give a generic textbook explanation with no project context.",
        "Do not skip the reason behind your decisions.",
        "Do not claim production ownership the resume does not support.",
    ]

    if question_type_hint == "behavioral":
        answer = (
            f"In my answer, I would use a clear STAR structure. I would start by setting up the situation around {focus_hint} "
            f"and explain the specific responsibility I owned as a student preparing for a {role_label} role. "
            f"Then I would walk through the actions I took using {skill_focus}, keeping the explanation practical and honest rather than inflated. "
            f"I would connect the story to {example_hint}, explain one tradeoff or challenge I had to manage, and close with the measurable result or the main lesson I took from it. "
            f"That makes the answer sound real, reflective, and directly relevant to the role."
        )
        highlights = [
            "Use STAR so the answer feels structured and easy to follow.",
            "Focus on what you personally owned and delivered.",
            "Close with a result, learning, or tradeoff.",
        ]
        framework = [
            "Situation and responsibility",
            "Actions you personally took",
            "Decision or tradeoff",
            "Result or learning",
        ]
        answer_hook = "Open with the situation and your specific responsibility before moving into action."
        delivery_tips = [
            "Keep the story compact and focused on one situation.",
            "Say what you personally did, not just what the team did.",
            "End with the result or lesson you took forward.",
        ]
        pitfalls = [
            "Do not spend too long setting up the background.",
            "Do not tell a team story without clarifying your role.",
            "Do not forget the result or learning.",
        ]
    elif difficulty == "hard":
        answer = (
            f"For a harder interview version of {focus_hint}, I would answer by first clarifying the goal, constraints, and system boundaries that matter for a {role_label} role. "
            f"Then I would explain my implementation or design choice using {skill_focus}, and justify it through tradeoffs like maintainability, performance, reliability, and delivery speed. "
            f"I would ground the answer in {example_hint} so it sounds practical, not theoretical. "
            f"After that, I would mention how I would validate the solution through testing, monitoring, or measurable outcomes, and I would finish by explaining one failure mode or scaling risk I would revisit if the system became more complex."
        )
        highlights = [
            "Frame the answer around architecture and tradeoffs.",
            "Use a real project or resume-backed example.",
            "Mention validation, failure modes, and scale.",
        ]
        framework = [
            "Goal and constraints",
            "Design or implementation choice",
            "Tradeoffs and justification",
            "Validation and next improvement",
        ]
        answer_hook = "Lead with the goal and constraints before describing your design choice."
        delivery_tips = [
            "Name the tradeoff you optimized for and why.",
            "Use one concrete example to stop the answer sounding abstract.",
            "Mention validation, monitoring, or failure handling.",
        ]
        pitfalls = [
            "Do not list architecture terms without justification.",
            "Do not ignore scale, reliability, or maintainability.",
            "Do not forget to mention how you would validate the solution.",
        ]
    else:
        answer = (
            f"I would answer this by first explaining the goal behind {focus_hint} and why it matters in a {role_label} interview. "
            f"Then I would walk through the practical steps I would take using {skill_focus}, while keeping the explanation tied to real work from {example_hint}. "
            f"I would make sure the answer sounds grounded by calling out one decision I made, the reason I chose that approach, and how I checked whether it worked. "
            f"To finish, I would mention a tradeoff, edge case, or improvement I would consider next, because that shows I can think beyond just the first implementation."
        )
        highlights = [
            "Start with the goal and context.",
            "Use a concrete example from your projects or resume.",
            "Explain the decision, validation, and tradeoff.",
        ]
        framework = [
            "Goal and context",
            "Implementation approach",
            "Project example",
            "Validation and tradeoff",
        ]

    if personalization_hint:
        highlights.append(personalization_hint)

    return {
        "answer": strip_markdown_noise(answer),
        "highlights": dedupe_lines(highlights)[:4],
        "answer_framework": dedupe_lines(framework)[:5],
        "answer_hook": answer_hook,
        "delivery_tips": dedupe_lines(delivery_tips)[:4],
        "pitfalls": dedupe_lines(pitfalls)[:4],
    }


def _answer_fallback(data: GenerateAnswerRequest, role: str, difficulty: str, skills: list[str]) -> GenerateAnswerResponse:
    bundle = _build_fallback_answer_bundle(
        question=data.question,
        role=role,
        difficulty=difficulty,
        skills=skills,
        projects=data.projects or "",
        experience=data.experience or "",
        resume_summary=data.resume_summary or "",
        resume_text=data.resume_text or "",
        focus_area=data.focus_area or "",
        question_type=data.question_type or "",
        personalization=data.personalization or "",
    )
    return GenerateAnswerResponse(
        answer=bundle["answer"],
        highlights=bundle["highlights"],
        answer_framework=bundle["answer_framework"],
        answer_hook=bundle["answer_hook"],
        delivery_tips=bundle["delivery_tips"],
        pitfalls=bundle["pitfalls"],
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
    improvement_plan = [
        "Open with the goal or situation before describing your steps.",
        "Add one concrete example with your personal ownership.",
        "Close with a result, tradeoff, or lesson learned.",
    ]

    return EvaluateAnswerResponse(
        strengths=dedupe_lines(strengths),
        weaknesses=dedupe_lines(weaknesses),
        improved_answer=strip_markdown_noise(improved_answer),
        verdict=verdict,
        score=score,
        improvement_plan=dedupe_lines(improvement_plan)[:4],
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
        what_to_cover = [
            "Use a concrete product or UI example.",
            "Explain the metric, feedback loop, or validation method.",
            "Mention what tradeoff you made and why.",
        ]
    elif role == "backend" or any(
        marker in question_text for marker in ("api", "database", "backend", "cache", "latency")
    ):
        follow_up_question = (
            "If traffic increased 10x after launch, what would you change first in the API, database, and monitoring strategy?"
        )
        reason = "Explores scale, reliability, and operational thinking."
        what_to_cover = [
            "Name the bottleneck you would inspect first.",
            "Explain the system or data tradeoff behind the change.",
            "Mention how you would monitor or validate improvement.",
        ]
    elif role == "data analyst" or any(
        marker in question_text
        for marker in ("sql", "dashboard", "analysis", "metric", "kpi", "power bi", "tableau")
    ):
        follow_up_question = (
            "How would you validate that the insight, dashboard, or metric you presented was actually reliable enough to influence a business decision?"
        )
        reason = "Pushes deeper on validation, data quality, stakeholder trust, and analytical decision-making."
        what_to_cover = [
            "Mention the data quality check or validation step you would run.",
            "Explain how you would verify the metric or dashboard is trustworthy.",
            "Show how that validation changes stakeholder confidence.",
        ]
    else:
        follow_up_question = (
            "What tradeoff would you revisit first if this solution had to support more users, faster iteration, and stricter reliability requirements?"
        )
        reason = "Moves the discussion from implementation to senior-level tradeoff thinking."
        what_to_cover = [
            "Use a concrete example instead of a generic explanation.",
            "Explain the decision or tradeoff behind your approach.",
            "Mention how you measured, validated, or improved the outcome.",
        ]

    return FollowUpResponse(
        follow_up_question=follow_up_question,
        reason=reason,
        what_to_cover=what_to_cover,
        fallback_used=True,
    )


def generate_interview_questions(data: GenerateQuestionsRequest) -> GenerateQuestionsResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    skills = _profile_skills(data.skills, data.resume_skills, role)
    resume_context = _resume_context_summary(data.resume_summary, data.resume_text)
    resume_anchors = _resume_anchor_points(role, skills, data)
    generation_round = max(1, (len(data.exclude_questions) // max(data.count, 1)) + 1)
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

Create a resume-based interview preparation pack with exactly {data.count} distinct interview questions and one strong model answer for each question.

Candidate profile:
- Target role: {ROLE_CONTEXT[role]['label']}
- Difficulty: {difficulty}
- Skills: {join_list_values(skills, 'Core software fundamentals')}
- Projects: {normalize_spaces(data.projects) or 'Not provided'}
- Experience: {normalize_spaces(data.experience) or 'Not provided'}
- Resume context: {resume_context}
- Resume anchors to use directly when possible: {json.dumps(resume_anchors, ensure_ascii=True)}
- Generation round: {generation_round}

Do not repeat or closely paraphrase any of these questions:
{json.dumps(unique_text_items(data.exclude_questions), ensure_ascii=True)}

Coverage requirements:
- Prioritize questions that are genuinely likely from this resume and role, not generic textbook questions.
- Use the candidate's actual tools, project themes, analysis tasks, datasets, dashboards, metrics, and decisions whenever the resume gives that evidence.
- At least 7 of the {data.count} questions should clearly connect to one or more resume anchors, project details, or resume skills.
- Mix conceptual, practical, debugging, system-design, and behavioral questions when relevant.
- Cover implementation detail, decision-making, tradeoffs, debugging, project depth, and communication.
- Since this is round {generation_round}, deliberately choose different angles than previous rounds and avoid near-duplicates.
- Avoid reusing the same opening pattern across the whole pack. The questions should feel like they came from a thoughtful human interviewer, not a repeated template.
- Difficulty guidance: {DIFFICULTY_GUIDANCE[difficulty]}

Answer requirements for every question:
- Write in first person as the student candidate.
- Keep each answer around 110 to 170 words.
- Ground the answer in the resume, projects, skills, and experience.
- If the resume does not prove a production claim, stay honest and frame it as project or academic experience.
- Prefer specific decisions, tradeoffs, validation, and outcomes over generic theory.
- Reference realistic analyst or engineering work only if the resume supports it.
- Do not use markdown, numbering, or bullet markers inside the answer string.

JSON shape:
{{
  "pack_summary": "one short paragraph",
  "questions": [
    {{
      "question": "string",
      "focus_area": "string",
      "question_type": "conceptual|practical|debugging|system-design|behavioral",
      "difficulty": "{difficulty}",
      "role": "{role}",
      "personalization": "one short sentence showing why this question fits the resume",
      "interviewer_intent": "one short sentence",
      "strong_signals": ["string", "string", "string"],
      "red_flags": ["string", "string", "string"],
      "answer": "string",
      "highlights": ["string", "string", "string"],
      "answer_framework": ["string", "string", "string", "string"]
    }}
  ]
}}
""".strip()

    fallback_used = False
    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior technical interviewer and hiring coach. "
                "Create resume-grounded interview preparation packs with realistic questions and believable model answers. "
                "Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.76,
            max_output_tokens=5200,
        )
        questions = _normalize_questions(payload, data, role, difficulty, skills)
    except Exception:
        fallback_used = True
        questions = _fallback_questions(data, role, difficulty, skills)

    focus_areas = unique_text_items(
        [item.focus_area for item in questions if normalize_spaces(item.focus_area)]
    )[:6]
    pack_summary = normalize_spaces(payload.get("pack_summary", "")) if not fallback_used and isinstance(payload, dict) else ""
    if not pack_summary:
        pack_summary = _question_pack_summary(
            role=role,
            difficulty=difficulty,
            skills=skills,
            resume_anchors=resume_anchors,
            questions=questions,
        )

    return GenerateQuestionsResponse(
        questions=questions,
        role=role,
        difficulty=difficulty,
        profile_summary=profile_summary,
        pack_summary=pack_summary,
        focus_areas=focus_areas,
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
    focus_area = normalize_spaces(data.focus_area)
    question_type = normalize_spaces(data.question_type)
    personalization = normalize_spaces(data.personalization)

    prompt = f"""
Return only valid JSON.

Write the best possible interview-ready answer for this question:
{data.question}

Candidate background:
- {profile_summary}
- Focus area: {focus_area or 'Not specified'}
- Question type: {question_type or 'Not specified'}
- Personalization clue: {personalization or 'Use the strongest resume-backed example.'}
- Previous answers to avoid repeating: {json.dumps(unique_text_items(data.previous_answers), ensure_ascii=True)}
- Difficulty target: {difficulty}

Rules:
- Write in first person as the candidate.
- Make the answer practical, believable, and well structured.
- Use a concrete example from the resume, projects, or experience.
- Reuse the closest matching tools, metrics, dashboards, datasets, or implementation details from the profile instead of drifting into generic examples.
- Do not sound like a textbook, blog post, or coaching template.
- Vary the opening and the example details so regenerated answers do not feel copied from the same pattern.
- If the resume does not clearly prove production-scale ownership, stay honest and frame the answer around project or academic work.
- For behavioral questions, use a compact STAR flow.
- For technical questions, explain the decision, tradeoff, validation, and result.
- Keep the answer around 130 to 190 words.
- Do not repeat previous answers closely.

JSON shape:
{{
  "answer": "string",
  "highlights": ["string", "string", "string"],
  "answer_framework": ["string", "string", "string", "string"],
  "answer_hook": "one short sentence for how to open this answer strongly",
  "delivery_tips": ["string", "string", "string"],
  "pitfalls": ["string", "string", "string"]
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior technical interviewer and mentor. "
                "Create strong, believable, resume-grounded model answers for student interviews. Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.74,
            max_output_tokens=1400,
        )
        answer = strip_markdown_noise(payload.get("answer", "")) if isinstance(payload, dict) else ""
        highlights = _coerce_text_list(payload.get("highlights", [])) if isinstance(payload, dict) else []
        framework = _coerce_text_list(payload.get("answer_framework", [])) if isinstance(payload, dict) else []
        answer_hook = normalize_spaces(payload.get("answer_hook", "")) if isinstance(payload, dict) else ""
        delivery_tips = _coerce_text_list(payload.get("delivery_tips", [])) if isinstance(payload, dict) else []
        pitfalls = _coerce_text_list(payload.get("pitfalls", [])) if isinstance(payload, dict) else []

        if not answer or word_count(answer) < 45:
            raise ValueError("Generated answer was too short")

        if not answer_hook or not delivery_tips or not pitfalls:
            fallback_bundle = _build_fallback_answer_bundle(
                question=data.question,
                role=role,
                difficulty=difficulty,
                skills=skills,
                projects=data.projects or "",
                experience=data.experience or "",
                resume_summary=data.resume_summary or "",
                resume_text=data.resume_text or "",
                focus_area=data.focus_area or "",
                question_type=data.question_type or "",
                personalization=data.personalization or "",
            )
            answer_hook = answer_hook or fallback_bundle["answer_hook"]
            delivery_tips = delivery_tips or fallback_bundle["delivery_tips"]
            pitfalls = pitfalls or fallback_bundle["pitfalls"]

        return GenerateAnswerResponse(
            answer=answer,
            highlights=highlights[:4],
            answer_framework=framework[:5],
            answer_hook=answer_hook,
            delivery_tips=delivery_tips[:4],
            pitfalls=pitfalls[:4],
            fallback_used=False,
        )
    except Exception:
        return _answer_fallback(data, role, difficulty, skills)


def evaluate_interview_answer(data: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    profile_summary = _profile_summary(
        _profile_skills([], data.resume_skills, role),
        data.projects or "",
        data.experience or "",
        role,
        data.resume_summary or "",
        "",
    )

    prompt = f"""
Return only valid JSON.

Evaluate this student interview answer like a real interviewer.

Question:
{data.question}

Student answer:
{data.user_answer}

Target role: {ROLE_CONTEXT[role]['label']}
Difficulty: {difficulty}
Candidate background: {profile_summary}

Rules:
- Be constructive, practical, and specific.
- Mention strengths and weaknesses separately.
- Write an improved answer that sounds polished but still believable for this candidate background.
- Give a score from 0 to 100.

JSON shape:
{{
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string", "string"],
  "improved_answer": "string",
  "verdict": "string",
  "score": 0,
  "improvement_plan": ["string", "string", "string"]
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior interviewer giving honest, practical answer feedback that stays grounded in the candidate's profile. Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.65,
            max_output_tokens=1500,
        )
        strengths = _coerce_text_list(payload.get("strengths", [])) if isinstance(payload, dict) else []
        weaknesses = _coerce_text_list(payload.get("weaknesses", [])) if isinstance(payload, dict) else []
        improved_answer = (
            strip_markdown_noise(payload.get("improved_answer", "")) if isinstance(payload, dict) else ""
        )
        verdict = normalize_spaces(payload.get("verdict", "")) if isinstance(payload, dict) else ""
        score = payload.get("score", 0) if isinstance(payload, dict) else 0
        improvement_plan = _coerce_text_list(payload.get("improvement_plan", [])) if isinstance(payload, dict) else []
        score = max(0, min(100, int(score or 0)))

        if not improved_answer:
            raise ValueError("Missing improved answer")

        if not improvement_plan:
            improvement_plan = [
                "Make your opening clearer and more direct.",
                "Add one stronger project example with your personal ownership.",
                "Finish with outcome, tradeoff, or validation.",
            ]

        return EvaluateAnswerResponse(
            strengths=strengths[:4],
            weaknesses=weaknesses[:4],
            improved_answer=improved_answer,
            verdict=verdict,
            score=score,
            improvement_plan=improvement_plan[:4],
            fallback_used=False,
        )
    except Exception:
        return _feedback_fallback(data, role)


def generate_follow_up_question(data: FollowUpRequest) -> FollowUpResponse:
    role = _normalize_role(data.role)
    difficulty = _normalize_difficulty(data.difficulty)
    profile_summary = _profile_summary(
        _profile_skills([], data.resume_skills, role),
        data.projects or "",
        data.experience or "",
        role,
        data.resume_summary or "",
        "",
    )

    prompt = f"""
Return only valid JSON.

Generate one deeper follow-up interview question based on this exchange.

Original question:
{data.question}

Student answer:
{data.user_answer}

Target role: {ROLE_CONTEXT[role]['label']}
Difficulty: {difficulty}
Candidate background: {profile_summary}

Rules:
- Ask exactly one follow-up question.
- Make it deeper than the original, not broader.
- Focus on tradeoffs, debugging, scale, decision-making, or evidence behind the answer.
- Keep it grounded in the candidate's background rather than inventing unrelated scenarios.
- Avoid generic phrases like "can you elaborate" unless you immediately tie them to a concrete claim from the answer.

JSON shape:
{{
  "follow_up_question": "string",
  "reason": "one short sentence",
  "what_to_cover": ["string", "string", "string"]
}}
""".strip()

    try:
        payload = _call_gemini_json(
            system_instruction=(
                "You are a senior technical interviewer who asks sharp, deeper follow-up questions. Return strict JSON only."
            ),
            prompt=prompt,
            temperature=0.88,
            max_output_tokens=500,
        )
        follow_up_question = (
            normalize_spaces(payload.get("follow_up_question", "")) if isinstance(payload, dict) else ""
        )
        reason = normalize_spaces(payload.get("reason", "")) if isinstance(payload, dict) else ""
        what_to_cover = _coerce_text_list(payload.get("what_to_cover", [])) if isinstance(payload, dict) else []

        if not follow_up_question:
            raise ValueError("Missing follow-up question")

        if not what_to_cover:
            what_to_cover = [
                "Use one concrete example instead of a generic explanation.",
                "Explain the tradeoff or decision behind your answer.",
                "Mention how you measured, validated, or improved the result.",
            ]

        return FollowUpResponse(
            follow_up_question=follow_up_question,
            reason=reason,
            what_to_cover=what_to_cover[:4],
            fallback_used=False,
        )
    except Exception:
        return _follow_up_fallback(data, role)
