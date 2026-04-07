from __future__ import annotations

import re
from typing import Iterable


def normalize_spaces(text: str | None) -> str:
    return " ".join(str(text or "").split())


def word_count(text: str | None) -> int:
    return len(normalize_spaces(text).split())


def unique_text_items(items: Iterable[str]) -> list[str]:
    unique_items: list[str] = []
    seen: set[str] = set()

    for item in items:
        value = normalize_spaces(item)
        normalized = value.lower()

        if not value or normalized in seen:
            continue

        seen.add(normalized)
        unique_items.append(value)

    return unique_items


def unique_lower_items(items: Iterable[str]) -> list[str]:
    return [item.lower() for item in unique_text_items(items)]


def join_list_values(items: Iterable[str], fallback: str = "Not specified") -> str:
    cleaned = unique_text_items(items)
    return ", ".join(cleaned) if cleaned else fallback


def strip_markdown_noise(text: str | None) -> str:
    value = str(text or "").replace("\r\n", "\n")
    value = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", value)
    value = re.sub(r"\*\*(.*?)\*\*", r"\1", value)
    value = re.sub(r"__(.*?)__", r"\1", value)
    value = re.sub(r"\*(.*?)\*", r"\1", value)
    value = re.sub(r"_(.*?)_", r"\1", value)
    value = value.replace("`", "")
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def remove_instruction_lines(text: str | None, blocked_prefixes: tuple[str, ...]) -> str:
    cleaned_lines: list[str] = []

    for line in str(text or "").splitlines():
        stripped = line.strip()
        lowered = stripped.lower()

        if lowered.startswith(blocked_prefixes):
            continue

        cleaned_lines.append(line.rstrip())

    return "\n".join(cleaned_lines).strip()


def strip_prompt_echo(text: str | None, prompt: str | None = "") -> str:
    cleaned = str(text or "").strip()
    prompt_text = str(prompt or "").strip()

    if prompt_text and prompt_text in cleaned:
        cleaned = cleaned.split(prompt_text, 1)[-1].strip()

    normalized_prompt = normalize_spaces(prompt_text)
    normalized_cleaned = normalize_spaces(cleaned)

    if normalized_prompt and normalized_cleaned.startswith(normalized_prompt):
        normalized_cleaned = normalized_cleaned[len(normalized_prompt) :].strip()
        cleaned = normalized_cleaned

    return cleaned.strip()


def dedupe_lines(lines: Iterable[str]) -> list[str]:
    unique_lines: list[str] = []
    seen: set[str] = set()

    for line in lines:
        value = normalize_spaces(line)
        normalized = value.lower()

        if not value or normalized in seen:
            continue

        seen.add(normalized)
        unique_lines.append(value)

    return unique_lines


def dedupe_sentences(text: str | None) -> str:
    raw_text = str(text or "").strip()
    if not raw_text:
        return ""

    sentence_candidates = re.split(r"(?<=[.!?])\s+", raw_text)
    cleaned_sentences: list[str] = []
    seen: set[str] = set()

    for sentence in sentence_candidates:
        value = normalize_spaces(sentence)
        normalized = value.lower()

        if not value or normalized in seen:
            continue

        seen.add(normalized)
        cleaned_sentences.append(value)

    return " ".join(cleaned_sentences).strip()


def clean_chatbot_response(text: str | None) -> str:
    cleaned = strip_markdown_noise(text)
    cleaned_lines: list[str] = []
    seen: set[str] = set()

    for raw_line in cleaned.splitlines():
        stripped = raw_line.strip()

        if not stripped:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue

        is_bullet = stripped.startswith(("-", "*"))
        is_heading = stripped.endswith(":")
        normalized_line = normalize_spaces(stripped.lstrip("-* ").strip())

        if not normalized_line:
            continue

        rendered_line = normalized_line
        if is_bullet:
            rendered_line = f"- {normalized_line}"
        elif not is_heading:
            rendered_line = dedupe_sentences(normalized_line)

        dedupe_key = rendered_line.lower()
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        cleaned_lines.append(rendered_line)

    cleaned = "\n".join(cleaned_lines).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()
