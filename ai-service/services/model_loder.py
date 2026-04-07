from __future__ import annotations

import os
from dataclasses import dataclass, field
from threading import Lock
from typing import Any


@dataclass
class ModelRegistry:
    embedding_model_name: str = field(
        default_factory=lambda: os.getenv(
            "EMBEDDING_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2",
        )
    )
    embedding_model: Any | None = None
    embedding_model_error: str | None = None
    job_generator: Any | None = None
    job_generator_mode: str | None = None
    job_generator_model: str | None = None
    job_generator_error: str | None = None
    initialized: bool = False


_registry = ModelRegistry()
_registry_lock = Lock()


def _load_embedding_model(registry: ModelRegistry) -> None:
    try:
        from sentence_transformers import SentenceTransformer

        registry.embedding_model = SentenceTransformer(registry.embedding_model_name)
        registry.embedding_model_error = None
        print(f"Resume embedding model loaded: {registry.embedding_model_name}")
    except Exception as exc:  # pragma: no cover - depends on runtime environment
        registry.embedding_model = None
        registry.embedding_model_error = str(exc)
        print(f"Resume embedding model unavailable: {exc}")


def _load_job_generator(registry: ModelRegistry) -> None:
    try:
        from transformers import pipeline
    except Exception as exc:  # pragma: no cover - depends on runtime environment
        registry.job_generator = None
        registry.job_generator_mode = None
        registry.job_generator_model = None
        registry.job_generator_error = str(exc)
        print(f"Text generation pipeline unavailable: {exc}")
        return

    preferred_model = os.getenv("JOB_GENERATION_MODEL", "google/flan-t5-base")
    fallback_model = os.getenv("JOB_GENERATION_FALLBACK_MODEL", "distilgpt2")

    try:
        registry.job_generator = pipeline(
            "text2text-generation",
            model=preferred_model,
        )
        registry.job_generator_mode = "text2text-generation"
        registry.job_generator_model = preferred_model
        registry.job_generator_error = None
        print(f"Job generator loaded: {preferred_model}")
        return
    except Exception as primary_exc:  # pragma: no cover - depends on runtime environment
        try:
            registry.job_generator = pipeline(
                "text-generation",
                model=fallback_model,
            )
            registry.job_generator_mode = "text-generation"
            registry.job_generator_model = fallback_model
            registry.job_generator_error = None
            print(
                "Primary text2text generator unavailable. "
                f"Using fallback generator: {fallback_model}"
            )
            return
        except Exception as fallback_exc:  # pragma: no cover - depends on runtime environment
            registry.job_generator = None
            registry.job_generator_mode = None
            registry.job_generator_model = None
            registry.job_generator_error = (
                f"text2text failure: {primary_exc} | "
                f"text-generation fallback failure: {fallback_exc}"
            )
            print(f"Job generator unavailable: {registry.job_generator_error}")


def load_models(force: bool = False) -> ModelRegistry:
    with _registry_lock:
        if _registry.initialized and not force:
            return _registry

        _load_embedding_model(_registry)
        _load_job_generator(_registry)
        _registry.initialized = True
        return _registry


def get_registry() -> ModelRegistry:
    if not _registry.initialized:
        return load_models()
    return _registry


def get_health_payload() -> dict[str, object]:
    registry = get_registry()
    status = "ok"

    if registry.embedding_model is None and registry.job_generator is None:
        status = "degraded"
    elif registry.embedding_model is None or registry.job_generator is None:
        status = "partial"

    return {
        "status": status,
        "resume_model": registry.embedding_model_name,
        "resume_model_loaded": registry.embedding_model is not None,
        "resume_model_error": registry.embedding_model_error,
        "job_generator_loaded": registry.job_generator is not None,
        "job_generator_mode": registry.job_generator_mode,
        "job_generator_model": registry.job_generator_model,
        "job_generator_error": registry.job_generator_error,
    }
