from fastapi import FastAPI

from routers.chat_router import router as chat_router
from routers.interview_qa_router import router as interview_qa_router
from routers.job_router import router as job_router
from routers.match_router import router as match_router
from routers.mock_interview_router import router as mock_interview_router
from services.model_loder import get_health_payload, load_models


app = FastAPI(
    title="Placement Cell AI Service",
    version="1.0.0",
    description=(
        "AI service for resume matching, job description generation, "
        "and placement chatbot support."
    ),
)


@app.on_event("startup")
def startup_event() -> None:
    load_models()


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": "placement-cell-ai",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "resume_match": "/match",
            "job_description": "/generate-job-description",
            "chatbot": "/ai/chat",
            "interview_questions": "/ai/generate-questions",
            "interview_answer": "/ai/generate-answer",
            "interview_feedback": "/ai/evaluate-answer",
            "interview_follow_up": "/ai/follow-up",
            "mock_interview_start": "/ai/mock-interview/start",
            "mock_interview_next": "/ai/mock-interview/next",
            "mock_interview_finish": "/ai/mock-interview/finish",
        },
    }


@app.get("/health")
def health() -> dict[str, object]:
    return get_health_payload()


app.include_router(match_router)
app.include_router(job_router)
app.include_router(chat_router)
app.include_router(interview_qa_router)
app.include_router(mock_interview_router)
