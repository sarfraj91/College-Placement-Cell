from __future__ import annotations

import math
import re
from typing import Any, Iterable

from utils.text_utils import normalize_spaces


TECH_SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "python": ("python",),
    "java": ("java",),
    "javascript": ("javascript", "js"),
    "typescript": ("typescript", "ts"),
    "react": ("react", "react.js", "reactjs"),
    "node.js": ("node.js", "node js", "nodejs", "node"),
    "express.js": ("express", "express.js", "expressjs"),
    "fastapi": ("fastapi", "fast api"),
    "django": ("django",),
    "flask": ("flask",),
    "sql": ("sql",),
    "mysql": ("mysql",),
    "postgresql": ("postgresql", "postgres", "postgre sql"),
    "mongodb": ("mongodb", "mongo db"),
    "redis": ("redis",),
    "docker": ("docker",),
    "kubernetes": ("kubernetes", "k8s"),
    "aws": ("aws", "amazon web services"),
    "azure": ("azure", "microsoft azure"),
    "gcp": ("gcp", "google cloud", "google cloud platform"),
    "git": ("git", "github"),
    "linux": ("linux",),
    "html": ("html", "html5"),
    "css": ("css", "css3"),
    "tailwind css": ("tailwind", "tailwind css"),
    "bootstrap": ("bootstrap",),
    "rest api": ("rest api", "restful api"),
    "graphql": ("graphql",),
    "machine learning": ("machine learning", "ml"),
    "deep learning": ("deep learning",),
    "data analysis": ("data analysis", "data analytics"),
    "pandas": ("pandas",),
    "numpy": ("numpy",),
    "scikit-learn": ("scikit-learn", "sklearn"),
    "tensorflow": ("tensorflow",),
    "pytorch": ("pytorch",),
    "excel": ("excel", "microsoft excel"),
    "power bi": ("power bi", "powerbi"),
    "tableau": ("tableau",),
}


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "with",
    "your",
}


TOKEN_PATTERN = re.compile(r"[a-z0-9][a-z0-9.+#/-]*")


def _compile_skill_pattern(alias: str) -> re.Pattern[str]:
    escaped = re.escape(alias.strip().lower())
    flexible_spacing = escaped.replace(r"\ ", r"\s+")
    return re.compile(rf"(?<!\w){flexible_spacing}(?!\w)", re.IGNORECASE)


TECH_SKILL_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    skill: tuple(_compile_skill_pattern(alias) for alias in aliases)
    for skill, aliases in TECH_SKILL_ALIASES.items()
}


def canonicalize_skill(raw_skill: str | None) -> str:
    normalized_skill = normalize_spaces(raw_skill).lower()
    if not normalized_skill:
        return ""

    for skill, patterns in TECH_SKILL_PATTERNS.items():
        if any(pattern.search(normalized_skill) for pattern in patterns):
            return skill

    return normalized_skill


def extract_skills(text: str | None) -> list[str]:
    normalized_text = normalize_spaces(str(text or "").lower())
    matched_skills = []

    for skill, patterns in TECH_SKILL_PATTERNS.items():
        if any(pattern.search(normalized_text) for pattern in patterns):
            matched_skills.append(skill)

    return matched_skills


def canonicalize_skill_list(skills: Iterable[str] | None) -> list[str]:
    canonical_skills = []

    for skill in skills or []:
        normalized_skill = canonicalize_skill(skill)
        if normalized_skill:
            canonical_skills.append(normalized_skill)

    return list(dict.fromkeys(canonical_skills))


def _build_skill_suggestion(skill: str) -> str:
    if skill in {"docker", "kubernetes", "aws", "azure", "gcp"}:
        return f"Add a project or deployment example that shows hands-on experience with {skill}."
    if skill in {"sql", "mysql", "postgresql", "mongodb", "redis"}:
        return f"Highlight database work involving {skill}, including schema design, querying, or optimization."
    if skill in {
        "python",
        "java",
        "javascript",
        "typescript",
        "react",
        "node.js",
        "express.js",
        "fastapi",
        "django",
        "flask",
    }:
        return f"Mention a real project, internship, or production feature where you used {skill} to solve a business problem."
    if skill in {
        "machine learning",
        "deep learning",
        "pandas",
        "numpy",
        "scikit-learn",
        "tensorflow",
        "pytorch",
        "data analysis",
    }:
        return f"Add a data-focused project that demonstrates {skill}, the dataset used, and the outcome achieved."
    return f"Add a project, internship bullet, or certification that demonstrates {skill} in practice."


def _generate_resume_suggestions(resume_text: str, missing_skills: list[str]) -> list[str]:
    suggestions = [_build_skill_suggestion(skill) for skill in missing_skills[:5]]
    lowered_resume = str(resume_text or "").lower()

    if not re.search(r"\b\d", lowered_resume):
        suggestions.append(
            "Add measurable achievements with metrics such as performance gains, delivery speed, or users impacted."
        )

    if "project" not in lowered_resume:
        suggestions.append(
            "Add a projects section that connects your tools, responsibilities, and outcomes."
        )

    if "github.com" not in lowered_resume and "portfolio" not in lowered_resume:
        suggestions.append(
            "Include GitHub, portfolio, or live deployment links for your strongest technical work."
        )

    return list(dict.fromkeys(suggestions))


def analyze_skill_gap_from_skills(
    resume_skills: Iterable[str] | None,
    job_skills: Iterable[str] | None,
    resume_text: str | None = "",
) -> dict[str, object]:
    normalized_resume_skills = canonicalize_skill_list(resume_skills)
    normalized_job_skills = canonicalize_skill_list(job_skills)

    resume_skill_set = set(normalized_resume_skills)
    matched_skills = [skill for skill in normalized_job_skills if skill in resume_skill_set]
    missing_skills = [skill for skill in normalized_job_skills if skill not in resume_skill_set]
    skill_gap_percent = (
        round((len(missing_skills) / len(normalized_job_skills)) * 100)
        if normalized_job_skills
        else 0
    )

    suggestions = _generate_resume_suggestions(resume_text or "", missing_skills)
    if not suggestions and missing_skills:
        suggestions = [_build_skill_suggestion(skill) for skill in missing_skills[:5]]

    return {
        "resume_skills": normalized_resume_skills,
        "job_skills": normalized_job_skills,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "skill_gap_percent": skill_gap_percent,
        "suggestions": suggestions,
    }


def analyze_skill_gap(resume_text: str, job_description: str) -> dict[str, object]:
    resume_skills = extract_skills(resume_text)
    job_skills = extract_skills(job_description)
    return analyze_skill_gap_from_skills(resume_skills, job_skills, resume_text)


def _tokenize(text: str | None) -> set[str]:
    tokens = TOKEN_PATTERN.findall(str(text or "").lower())
    return {token for token in tokens if token not in STOP_WORDS and len(token) > 1}


def _jaccard_similarity(text_a: str, text_b: str) -> float:
    tokens_a = _tokenize(text_a)
    tokens_b = _tokenize(text_b)

    if not tokens_a or not tokens_b:
        return 0.0

    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union else 0.0


def _cosine_similarity_from_lists(values_a: list[float], values_b: list[float]) -> float:
    if not values_a or not values_b or len(values_a) != len(values_b):
        return 0.0

    dot_product = sum(first * second for first, second in zip(values_a, values_b))
    norm_a = math.sqrt(sum(value * value for value in values_a))
    norm_b = math.sqrt(sum(value * value for value in values_b))

    if not norm_a or not norm_b:
        return 0.0

    return dot_product / (norm_a * norm_b)


def _model_similarity(text_a: str, text_b: str, model: Any) -> float:
    embeddings = model.encode([text_a, text_b], convert_to_tensor=False)
    first_embedding = embeddings[0]
    second_embedding = embeddings[1]

    try:
        values_a = first_embedding.tolist()
        values_b = second_embedding.tolist()
    except AttributeError:
        values_a = list(first_embedding)
        values_b = list(second_embedding)

    return float(_cosine_similarity_from_lists(values_a, values_b))


def match_resume_to_job(
    resume_text: str,
    job_description: str,
    model: Any | None = None,
) -> dict[str, object]:
    resume_value = normalize_spaces(resume_text)
    job_value = normalize_spaces(job_description)

    if not resume_value or not job_value:
        raise ValueError("resume_text and job_description must be non-empty.")

    matching_method = "lexical-fallback"
    similarity_score = _jaccard_similarity(resume_value, job_value)

    if model is not None:
        try:
            similarity_score = max(-1.0, min(1.0, _model_similarity(resume_value, job_value, model)))
            similarity_score = (similarity_score + 1.0) / 2.0
            matching_method = "semantic-model"
        except Exception:
            similarity_score = _jaccard_similarity(resume_value, job_value)
            matching_method = "lexical-fallback"

    raw_similarity = round((similarity_score * 2.0) - 1.0, 6)
    semantic_score = round(max(0.0, min(1.0, similarity_score)) * 100.0, 2)
    skill_gap_analysis = analyze_skill_gap(resume_value, job_value)

    return {
        "semantic_score": semantic_score,
        "raw_similarity": raw_similarity,
        "matching_method": matching_method,
        **skill_gap_analysis,
    }


def rank_texts_by_relevance(
    query: str,
    texts: list[str],
    model: Any | None = None,
) -> list[tuple[int, float]]:
    if not texts:
        return []

    scored_items: list[tuple[int, float]] = []

    if model is not None:
        try:
            embeddings = model.encode([query, *texts], convert_to_tensor=False)
            query_embedding = embeddings[0]
            query_values = (
                query_embedding.tolist()
                if hasattr(query_embedding, "tolist")
                else list(query_embedding)
            )

            for index, embedding in enumerate(embeddings[1:]):
                values = embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)
                score = _cosine_similarity_from_lists(query_values, values)
                scored_items.append((index, score))
        except Exception:
            scored_items = []

    if not scored_items:
        scored_items = [
            (index, _jaccard_similarity(query, text))
            for index, text in enumerate(texts)
        ]

    return sorted(scored_items, key=lambda item: item[1], reverse=True)
