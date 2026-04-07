from fastapi import APIRouter, HTTPException

from models.schemas import MatchRequest
from services.embedding_service import match_resume_to_job
from services.model_loder import get_registry


router = APIRouter(tags=["resume-intelligence"])


@router.post("/match")
def match(data: MatchRequest) -> dict[str, object]:
    try:
        registry = get_registry()
        return match_resume_to_job(
            data.resume_text,
            data.job_description,
            registry.embedding_model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Resume matching failed: {exc}",
        ) from exc
