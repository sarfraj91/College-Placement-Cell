#this file is for testing genAI API, not for production use.

import os
from pathlib import Path

from google import genai


ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
DEFAULT_MODEL_NAME = "gemini-2.5-flash"
PROMPT = "Write how to make a resume for a software engineer."


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        value = value.strip().strip("\"'")
        os.environ.setdefault(key.strip(), value)


def main() -> int:
    load_env_file(ENV_PATH)

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", DEFAULT_MODEL_NAME)

    if not api_key:
        print("Set GEMINI_API_KEY or GOOGLE_API_KEY before running genAI.py.")
        return 1

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=PROMPT,
    )
    print(response.text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
