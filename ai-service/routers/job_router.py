from fastapi import APIRouter, HTTPException

from models.schemas import JobRequest
from services.job_service import generate_job_description
from services.model_loder import get_registry


router = APIRouter(tags=["job-description"])


@router.post("/generate-job-description")
def generate_job_description_route(data: JobRequest) -> dict[str, object]:
    try:
        registry = get_registry()
        return generate_job_description(data, registry)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Job description generation failed: {exc}",
        ) from exc
