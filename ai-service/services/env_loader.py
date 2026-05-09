from __future__ import annotations

import os
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
ENV_CANDIDATES = (
    SERVICE_ROOT / ".env",
    SERVICE_ROOT / "services" / ".env",
    SERVICE_ROOT / ".env.local",
)

_LOADED_PATHS: set[Path] = set()


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def ensure_service_env_loaded() -> list[Path]:
    loaded_paths: list[Path] = []

    for env_path in ENV_CANDIDATES:
        if env_path in _LOADED_PATHS or not env_path.exists():
            continue

        _load_env_file(env_path)
        _LOADED_PATHS.add(env_path)
        loaded_paths.append(env_path)

    return loaded_paths


def get_gemini_settings(default_model: str) -> tuple[str, str]:
    ensure_service_env_loaded()

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", default_model)

    if not api_key:
        searched = ", ".join(str(path) for path in ENV_CANDIDATES)
        raise RuntimeError(
            f"Gemini API key was not found. Checked environment and env files at: {searched}"
        )

    return api_key, model_name
