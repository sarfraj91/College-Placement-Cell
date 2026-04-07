from __future__ import annotations

from dataclasses import dataclass
from models.schemas import ChatContext
from utils.text_utils import normalize_spaces, unique_text_items


@dataclass(frozen=True)
class IntentRule:
    name: str
    keywords: tuple[str, ...]


INTENT_RULES = (
    IntentRule("resume", ("resume", "cv", "ats", "improve resume")),
    IntentRule("skills", ("skills", "skill gap", "learn", "roadmap")),
    IntentRule("jobs", ("job", "jobs", "apply", "opening", "internship")),
    IntentRule("interview", ("interview", "dsa", "hr", "coding")),
)

GREETING_TERMS = {"hi", "hello", "hey"}


def is_greeting_message(question: str) -> bool:
    q = normalize_spaces(question).lower()
    return q in GREETING_TERMS or any(q.startswith(g) for g in GREETING_TERMS)


def detect_intent(question: str, history=None, context: ChatContext | None = None):
    q = normalize_spaces(question).lower()

    if is_greeting_message(q):
        return {"intent": "general", "confidence": 0.9}

    # 🔥 IMPORTANT: detect NON-placement questions
    general_keywords = ["where", "who", "what", "when", "capital", "define"]
    if any(word in q for word in general_keywords):
        return {"intent": "general", "confidence": 0.95}

    matched = []
    for rule in INTENT_RULES:
        if any(k in q for k in rule.keywords):
            matched.append(rule.name)

    if not matched:
        return {"intent": "general", "confidence": 0.6}

    return {
        "intent": matched[0],
        "confidence": 0.8,
        "secondary_intents": matched[1:],
    }