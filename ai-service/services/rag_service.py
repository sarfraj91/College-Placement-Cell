from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from services.embedding_service import extract_skills, rank_texts_by_relevance
from services.model_loder import ModelRegistry
from utils.text_utils import normalize_spaces, unique_text_items


DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "placement_data.txt"


EXTRA_KNOWLEDGE = [
    {
        "topic": "Resume Strategy",
        "bullets": [
            "Tailor your resume to the target role instead of sending one generic version everywhere.",
            "Use impact-based bullets that show measurable outcomes, ownership, and relevant tools.",
            "Place strong projects, internships, GitHub, and portfolio links where recruiters can see them quickly.",
        ],
    },
    {
        "topic": "Skill Gap Planning",
        "bullets": [
            "Choose one target role first and then close the highest-value missing skills for that role.",
            "Prefer project-backed proof over listing too many tools without evidence.",
            "Track matched skills, missing skills, and weekly progress in one roadmap.",
        ],
    },
    {
        "topic": "Technical Interviews",
        "bullets": [
            "Prepare DSA, debugging, fundamentals, and project explanations together.",
            "Be ready to explain tradeoffs, architecture, constraints, and production decisions.",
            "Practice speaking through your solution, not just writing code silently.",
        ],
    },
    {
        "topic": "HR Interviews",
        "bullets": [
            "Use clear examples for teamwork, conflict, leadership, and learning from mistakes.",
            "Keep the story concise: context, action, result, and takeaway.",
            "Stay honest, professional, and aligned with your target role.",
        ],
    },
    {
        "topic": "Placement Search",
        "bullets": [
            "Apply consistently to relevant roles instead of waiting only for perfect matches.",
            "Track deadlines, links, interview rounds, follow-ups, and outcomes.",
            "Use rejection or silence as feedback to improve resume, skills, or interview prep.",
        ],
    },
]


TOPIC_TAGS = {
    "resume": ("resume", "cv", "ats"),
    "skills": ("skill", "gap", "roadmap", "requirements"),
    "interview": ("interview", "technical", "coding", "dsa"),
    "hr": ("hr", "behavioral"),
    "jobs": ("job", "placement", "apply", "recommend"),
}


def _parse_knowledge_text(raw_text: str) -> list[dict[str, object]]:
    sections: list[dict[str, object]] = []
    current_topic = ""
    current_bullets: list[str] = []

    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.endswith(":"):
            if current_topic and current_bullets:
                sections.append({"topic": current_topic, "bullets": current_bullets[:]})
            current_topic = stripped[:-1].strip()
            current_bullets = []
            continue

        if stripped.startswith("-"):
            current_bullets.append(stripped[1:].strip())
        else:
            current_bullets.append(stripped)

    if current_topic and current_bullets:
        sections.append({"topic": current_topic, "bullets": current_bullets[:]})

    return sections


def _infer_tags(topic: str, bullets: list[str]) -> list[str]:
    text = normalize_spaces(f"{topic} {' '.join(bullets)}").lower()
    tags = []

    for tag, markers in TOPIC_TAGS.items():
        if any(marker in text for marker in markers):
            tags.append(tag)

    return unique_text_items(tags)


@lru_cache(maxsize=1)
def load_knowledge_base() -> list[dict[str, object]]:
    file_sections: list[dict[str, object]] = []
    if DATA_FILE.exists():
        file_sections = _parse_knowledge_text(DATA_FILE.read_text(encoding="utf-8"))

    sections = file_sections + EXTRA_KNOWLEDGE
    normalized_sections: list[dict[str, object]] = []

    for section in sections:
        topic = normalize_spaces(section.get("topic", "Placement Guidance"))
        bullets = unique_text_items(section.get("bullets", []))
        normalized_sections.append(
            {
                "topic": topic,
                "bullets": bullets,
                "tags": _infer_tags(topic, bullets),
                "content": f"{topic}: {' '.join(bullets)}",
            }
        )

    return normalized_sections


def _score_maps(items: list[tuple[int, float]]) -> dict[int, float]:
    return {index: max(0.0, float(score)) for index, score in items}


def _intent_boost(section: dict[str, object], intent: str) -> float:
    if not intent or intent == "general":
        return 0.04 if "jobs" in section.get("tags", []) else 0.0
    return 0.12 if intent in section.get("tags", []) else 0.0


def _skill_overlap_boost(query: str, section: dict[str, object]) -> float:
    query_skills = set(extract_skills(query))
    section_skills = set(extract_skills(section.get("content", "")))
    if not query_skills or not section_skills:
        return 0.0

    overlap = len(query_skills & section_skills)
    return min(0.2, overlap * 0.05)


def _is_in_scope(question: str, best_score: float, intent: str) -> bool:
    placement_terms = (
        "placement",
        "resume",
        "interview",
        "job",
        "skill",
        "company",
        "career",
        "campus",
    )
    lowered = question.lower()
    if any(term in lowered for term in placement_terms):
        return True
    if intent != "general":
        return True
    return best_score >= 0.08


def retrieve_relevant_sections(
    question: str,
    history: list[str] | None,
    registry: ModelRegistry,
    intent: str = "general",
    top_k: int = 3,
) -> list[dict[str, object]]:
    knowledge_base = load_knowledge_base()
    if not knowledge_base:
        return []

    expanded_query = normalize_spaces(" ".join([*(history or [])[-2:], question]))
    searchable_text = [section["content"] for section in knowledge_base]
    semantic_scores = _score_maps(
        rank_texts_by_relevance(expanded_query, searchable_text, registry.embedding_model)
    )
    lexical_scores = _score_maps(rank_texts_by_relevance(expanded_query, searchable_text, None))

    ranked_sections: list[dict[str, object]] = []
    for index, section in enumerate(knowledge_base):
        semantic_score = semantic_scores.get(index, 0.0)
        lexical_score = lexical_scores.get(index, 0.0)
        score = (
            (semantic_score * 0.6)
            + (lexical_score * 0.28)
            + _intent_boost(section, intent)
            + _skill_overlap_boost(expanded_query, section)
        )
        ranked_sections.append(
            {
                **section,
                "score": round(score, 4),
                "semantic_score": round(semantic_score, 4),
                "lexical_score": round(lexical_score, 4),
            }
        )

    ranked_sections.sort(key=lambda item: item["score"], reverse=True)
    best_score = ranked_sections[0]["score"] if ranked_sections else 0.0
    if not _is_in_scope(expanded_query, best_score, intent):
        return []

    filtered_sections = [section for section in ranked_sections if section["score"] >= 0.06]
    return filtered_sections[: max(1, min(top_k, 6))]


def build_grounded_context(sections: list[dict[str, object]]) -> str:
    if not sections:
        return "No strong grounded context found in the placement knowledge base."

    context_blocks = []
    for section in sections:
        bullets = "\n".join(f"- {bullet}" for bullet in section.get("bullets", [])[:4])
        context_blocks.append(f"{section['topic']}:\n{bullets}")

    return "\n\n".join(context_blocks).strip()
