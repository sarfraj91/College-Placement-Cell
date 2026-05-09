from __future__ import annotations

import sys
import time
from pathlib import Path

from google import genai


if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.env_loader import get_gemini_settings


DEFAULT_MODEL_NAME = "gemini-2.5-flash"
PROMPT = "Write how to make a resume for a software engineer."
MAX_RETRIES = 3
RETRY_BASE_DELAY_SECONDS = 2


def _is_transient_gemini_error(exc: Exception) -> bool:
    message = str(exc).upper()
    transient_markers = (
        "429",
        "500",
        "502",
        "503",
        "504",
        "RESOURCE_EXHAUSTED",
        "UNAVAILABLE",
        "DEADLINE_EXCEEDED",
    )
    return any(marker in message for marker in transient_markers)


def main() -> int:
    try:
        api_key, model_name = get_gemini_settings(DEFAULT_MODEL_NAME)
    except RuntimeError as exc:
        print(exc)
        return 1

    try:
        client = genai.Client(api_key=api_key)
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=PROMPT,
                )
                print(response.text or "No response received.")
                return 0
            except Exception as exc:
                if attempt == MAX_RETRIES or not _is_transient_gemini_error(exc):
                    raise

                delay_seconds = RETRY_BASE_DELAY_SECONDS * attempt
                print(
                    f"Gemini request hit a temporary error. Retrying in {delay_seconds} seconds..."
                )
                time.sleep(delay_seconds)
    except Exception as exc:
        print(f"Gemini request failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
