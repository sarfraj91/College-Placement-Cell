from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Iterable

from models.schemas import JobRequest
from services.embedding_service import extract_skills
from services.model_loder import ModelRegistry
from utils.text_utils import (
    join_list_values,
    normalize_spaces,
    remove_instruction_lines,
    strip_markdown_noise,
    strip_prompt_echo,
    unique_text_items,
    word_count,
)


def _looks_like_prompt_leak(text: str) -> bool:
    lowered = str(text or "").lower()
    markers = [
        "you are a senior technical recruiter",
        "structure:",
        "style rules:",
        "must-have skills:",
        "good-to-have skills:",
        "tech stack / dependencies:",
        "company overview:",
    ]
    return sum(1 for marker in markers if marker in lowered) >= 3


def _extract_description_from_generation(generated_text: str, prompt: str) -> str:
    cleaned = strip_prompt_echo(generated_text, prompt)

    marker = "FINAL JOB DESCRIPTION:"
    marker_index = cleaned.lower().find(marker.lower())
    if marker_index != -1:
        cleaned = cleaned[marker_index + len(marker) :].strip()

    cleaned = remove_instruction_lines(
        cleaned,
        (
            "you are a senior technical recruiter",
            "structure:",
            "style rules:",
            "1)",
            "2)",
            "3)",
            "4)",
            "5)",
            "6)",
        ),
    )
    cleaned = strip_markdown_noise(cleaned)
    cleaned = re.sub(r"^(?:[-*]\s*){3,}", "", cleaned).strip()
    return cleaned


def _extract_instruction_focus_areas(instructions: str) -> list[str]:
    cleaned = strip_markdown_noise(instructions or "")
    if not cleaned:
        return []

    focus_areas = []
    patterns = [
        r"(?:add|include|highlight|focus on|mention|emphasize)\s+([^.;\n]+)",
        r"(?:improve)\s+([^.;\n]+)",
    ]
    blocked_phrases = {
        "it",
        "the description",
        "job description",
        "wording",
        "tone",
        "clarity",
        "readability",
        "grammar",
    }

    for pattern in patterns:
        for match in re.findall(pattern, cleaned, flags=re.IGNORECASE):
            candidate = normalize_spaces(match)
            candidate = re.sub(r"^(?:the|a|an)\s+", "", candidate, flags=re.IGNORECASE)

            if not candidate or candidate.lower() in blocked_phrases:
                continue

            focus_areas.append(candidate)

    return unique_text_items(focus_areas)


def _instruction_has_any(instructions: str, keywords: tuple[str, ...]) -> bool:
    lowered = str(instructions or "").lower()
    return any(keyword in lowered for keyword in keywords)


def _is_meaningfully_different(original_text: str, updated_text: str) -> bool:
    original_norm = normalize_spaces(strip_markdown_noise(original_text or "")).lower()
    updated_norm = normalize_spaces(strip_markdown_noise(updated_text or "")).lower()

    if not updated_norm:
        return False

    if not original_norm:
        return True

    if original_norm == updated_norm:
        return False

    return SequenceMatcher(None, original_norm, updated_norm).ratio() < 0.985


def _build_job_description_prompt(data: JobRequest) -> tuple[str, str]:
    current_description = strip_markdown_noise(data.current_description or "")
    improvement_instructions = normalize_spaces(data.improvement_instructions or "")

    role_context = f"""
    Job Title: {data.job_title}
    Company: {data.company}
    Company Overview: {data.company_overview or "Fast-growing, innovation-focused organization"}
    Employment Type: {data.employment_type or "Full-time"}
    Work Mode: {data.work_mode or "Hybrid"}
    Location: {data.location or "As per business requirements"}
    Department: {data.department or "Engineering"}
    Experience Level: {data.experience_level or "1-3 years"}
    Must-have Skills: {join_list_values(data.skills, "Problem solving, communication, and role-relevant technical skills")}
    Good-to-have Skills: {join_list_values(data.good_to_have, "Ability to learn fast and collaborate in cross-functional teams")}
    Responsibilities: {join_list_values(data.responsibilities, "Build features, collaborate with teams, and maintain high quality")}
    Tech Stack / Dependencies: {join_list_values(data.dependencies, "Modern tools based on role needs")}
    Benefits: {join_list_values(data.benefits, "Learning opportunities, mentorship, and growth-focused culture")}
    """.strip()

    structure_block = """
    Structure:
    1) About the role
    2) Key responsibilities
    3) Required skills and qualifications
    4) Preferred skills
    5) What we offer
    6) Call to action

    Style rules:
    - Professional, concise, and engaging
    - Avoid placeholders and generic filler
    - Keep the output between 220 and 350 words

    Return ONLY final job description in plain text.
    Do not use markdown symbols.
    Start your response with exactly:
    FINAL JOB DESCRIPTION:
    """.strip()

    if current_description:
        admin_instructions = (
            improvement_instructions
            or "Improve clarity, correctness, structure, and readability while preserving the role facts."
        )
        prompt = f"""
        You are a senior technical recruiter. Revise the existing job description for a live hiring post.

        Existing Job Description:
        {current_description}

        Admin Improvement Instructions:
        {admin_instructions}

        Use the structured job details below as the source of truth while revising the description:
        {role_context}

        Additional rules:
        - Apply every relevant admin instruction
        - Preserve correct factual details unless the structured job details are more precise
        - Remove repetition, awkward phrasing, and vague filler
        - Keep the improved description polished and publication-ready
        - Make clear, visible changes when the admin asks to add, remove, shorten, or emphasize something
        - Do not return the previous description unchanged

        {structure_block}
        """
        return prompt, "regenerate"

    prompt = f"""
    You are a senior technical recruiter. Write a realistic and attractive job description for a live hiring post.

    {role_context}

    {structure_block}
    """
    return prompt, "generate"


def _build_template_description(data: JobRequest) -> str:
    responsibilities = unique_text_items(data.responsibilities or []) or [
        "Design, build, and ship production-ready features with strong quality standards",
        "Collaborate across product, design, and engineering teams to deliver measurable outcomes",
        "Participate in code reviews, documentation, and continuous improvement of development workflows",
    ]
    benefits = unique_text_items(data.benefits or []) or [
        "Mentorship and continuous learning opportunities",
        "Ownership-driven culture and high-impact work",
        "Collaborative team environment with growth focus",
    ]

    responsibilities_text = "\n".join(f"- {item}" for item in responsibilities)
    benefits_text = "\n".join(f"- {item}" for item in benefits)

    return f"""{data.job_title} at {data.company}

Location: {data.location or "As per business requirement"}
Employment Type: {data.employment_type or "Full-time"}
Work Mode: {data.work_mode or "Hybrid"}
Experience Level: {data.experience_level or "As per role"}

About the Role:
{data.company} is looking for a {data.job_title} to join the {data.department or "core"} team. You will contribute to meaningful projects, collaborate with cross-functional stakeholders, and help deliver scalable solutions aligned with business goals.

Key Responsibilities:
{responsibilities_text}

Required Skills and Qualifications:
- {join_list_values(data.skills, "Problem solving, communication, and role-relevant technical skills")}
- Strong understanding of software engineering fundamentals and delivery best practices

Preferred Skills:
- {join_list_values(data.good_to_have, "Ability to learn quickly and work effectively in cross-functional teams")}
- Exposure to {join_list_values(data.dependencies, "modern tools and role-specific dependencies")}

What We Offer:
{benefits_text}

Apply now to be part of a high-growth team building impactful solutions.
""".strip()


def _build_regenerated_description(data: JobRequest) -> str:
    instructions = normalize_spaces(data.improvement_instructions or "")
    focus_skills = extract_skills(instructions)
    focus_areas = _extract_instruction_focus_areas(instructions)
    concise_mode = _instruction_has_any(instructions, ("shorter", "concise", "crisp", "brief"))
    detailed_mode = _instruction_has_any(instructions, ("longer", "detailed", "elaborate", "expand"))
    internship_tone = _instruction_has_any(instructions, ("internship", "intern", "fresher", "entry level"))
    senior_tone = _instruction_has_any(instructions, ("senior", "leadership", "ownership", "lead role"))

    responsibilities = unique_text_items(data.responsibilities or []) or [
        "Design, build, and ship production-ready features with strong quality standards",
        "Collaborate across product, design, and engineering teams to deliver measurable outcomes",
        "Participate in code reviews, documentation, and continuous improvement of development workflows",
    ]
    benefits = unique_text_items(data.benefits or []) or [
        "Mentorship and continuous learning opportunities",
        "Ownership-driven culture and high-impact work",
        "Collaborative team environment with growth focus",
    ]

    required_skills = unique_text_items(list(data.skills or []) + focus_skills) or [
        "Problem solving",
        "Communication",
        "Role-relevant technical skills",
    ]
    preferred_skills = unique_text_items(
        list(data.good_to_have or [])
        + [area for area in focus_areas if area.lower() not in {skill.lower() for skill in required_skills}]
    )

    if focus_areas:
        responsibilities = unique_text_items(
            responsibilities + [f"Contribute to work that emphasizes {area}." for area in focus_areas[:2]]
        )

    if concise_mode:
        responsibilities = responsibilities[:3]
        benefits = benefits[:2]
        preferred_skills = preferred_skills[:2]
    elif detailed_mode and len(responsibilities) < 4:
        responsibilities.append(
            "Partner with stakeholders to translate business needs into clear, scalable execution plans."
        )

    tone_line = "This opportunity is ideal for candidates who enjoy solving practical problems and working in collaborative teams."
    if internship_tone:
        tone_line = "This role is well-suited for interns or early-career candidates who want hands-on exposure, mentorship, and meaningful project work."
    elif senior_tone:
        tone_line = "This role is suited for experienced professionals who can lead execution, influence technical direction, and deliver measurable outcomes."

    focus_line = ""
    if focus_areas:
        focus_line = f" We especially want to strengthen the description around {', '.join(focus_areas[:3])}."

    preferred_values = preferred_skills or [
        f"Exposure to {join_list_values(data.dependencies, 'modern tools and role-specific dependencies')}"
    ]

    return f"""{data.job_title} at {data.company}

Location: {data.location or "As per business requirement"}
Employment Type: {data.employment_type or "Full-time"}
Work Mode: {data.work_mode or "Hybrid"}
Experience Level: {data.experience_level or "As per role"}

About the Role:
{data.company} is looking for a {data.job_title} to join the {data.department or "core"} team. {tone_line}{focus_line}
This is a {data.employment_type or "Full-time"}{f" ({data.work_mode})" if data.work_mode else ""}{f" role based in {data.location}" if data.location else " opportunity"}.

Key Responsibilities:
{chr(10).join(f"- {item}" for item in responsibilities)}

Required Skills and Qualifications:
{chr(10).join(f"- {item}" for item in required_skills[:5])}

Preferred Skills:
{chr(10).join(f"- {item}" for item in preferred_values[:4])}

What We Offer:
{chr(10).join(f"- {item}" for item in benefits)}

Apply now to join {data.company} and help build impactful solutions with a team that values quality, collaboration, and growth.
""".strip()


def generate_job_description(data: JobRequest, registry: ModelRegistry) -> dict[str, object]:
    current_description = strip_markdown_noise(data.current_description or "")
    generation_mode = "regenerate" if current_description else "generate"
    fallback_used = False
    model_error = ""
    description = ""

    if registry.job_generator is not None:
        try:
            prompt, generation_mode = _build_job_description_prompt(data)
            generation_kwargs: dict[str, object] = {
                "max_new_tokens": 420 if registry.job_generator_mode == "text2text-generation" else 280,
                "do_sample": generation_mode != "regenerate",
            }

            if generation_mode != "regenerate":
                generation_kwargs["temperature"] = 0.75
                generation_kwargs["top_p"] = 0.92

            result = registry.job_generator(prompt, **generation_kwargs)
            candidate = ""

            if isinstance(result, list) and result:
                first_item = result[0]
                if isinstance(first_item, dict):
                    candidate = (
                        first_item.get("generated_text")
                        or first_item.get("summary_text")
                        or ""
                    )
                else:
                    candidate = str(first_item)

            description = _extract_description_from_generation(candidate, prompt)
        except Exception as exc:
            model_error = str(exc)

    if (
        not description
        or _looks_like_prompt_leak(description)
        or word_count(description) < 45
        or (generation_mode == "regenerate" and not _is_meaningfully_different(current_description, description))
    ):
        fallback_used = True
        description = (
            _build_regenerated_description(data)
            if generation_mode == "regenerate"
            else _build_template_description(data)
        )

    return {
        "job_title": data.job_title,
        "company": data.company,
        "description": description,
        "fallback_used": fallback_used,
        "generator_mode": registry.job_generator_mode,
        "generation_mode": generation_mode,
        "generator_available": registry.job_generator is not None,
        "generator_error": model_error or registry.job_generator_error,
    }


def build_chat_job_suggestions(
    recommended_jobs: Iterable[object] | None,
    external_jobs: Iterable[object] | None,
    max_items: int = 4,
) -> list[dict[str, object]]:
    suggestions: list[dict[str, object]] = []

    def _append_job(item: object, fallback_source: str) -> None:
        if len(suggestions) >= max_items:
            return

        job_id = getattr(item, "job_id", None) if hasattr(item, "job_id") else item.get("job_id", "")
        title = getattr(item, "job_title", None) if hasattr(item, "job_title") else item.get("job_title", "")
        company = getattr(item, "company", None) if hasattr(item, "company") else item.get("company", "")
        location = getattr(item, "location", None) if hasattr(item, "location") else item.get("location", "")
        link = getattr(item, "apply_url", None) if hasattr(item, "apply_url") else item.get("apply_url", "")
        source = getattr(item, "source", None) if hasattr(item, "source") else item.get("source", fallback_source)
        matched_skills = (
            getattr(item, "matched_skills", None)
            if hasattr(item, "matched_skills")
            else item.get("matched_skills", [])
        )

        normalized_title = normalize_spaces(title)
        if not normalized_title:
            return

        normalized_link = normalize_spaces(link)
        if not normalized_link and job_id:
            normalized_link = f"/student/jobs/{job_id}"

        suggestions.append(
            {
                "title": normalized_title,
                "link": normalized_link,
                "company": normalize_spaces(company),
                "location": normalize_spaces(location),
                "source": normalize_spaces(source or fallback_source),
                "matched_skills": unique_text_items(matched_skills or [])[:4],
                "reason": (
                    f"Matches skills: {', '.join(unique_text_items(matched_skills or [])[:3])}"
                    if matched_skills
                    else "Relevant for your current placement direction."
                ),
            }
        )

    for item in recommended_jobs or []:
        _append_job(item, "internal")

    for item in external_jobs or []:
        _append_job(item, "external")

    deduped: list[dict[str, object]] = []
    seen: set[str] = set()
    for item in suggestions:
        key = f"{item['title'].lower()}::{item['company'].lower()}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped[:max_items]
