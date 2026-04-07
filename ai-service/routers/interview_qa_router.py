import asyncio

from fastapi import APIRouter, HTTPException

from models.schemas import (
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    FollowUpRequest,
    FollowUpResponse,
    GenerateAnswerRequest,
    GenerateAnswerResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
)
from services.interview_qa_service import (
    evaluate_interview_answer,
    generate_follow_up_question,
    generate_interview_answer,
    generate_interview_questions,
)


router = APIRouter(prefix="/ai", tags=["interview-qa"])


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions_route(data: GenerateQuestionsRequest) -> GenerateQuestionsResponse:
    try:
        return await asyncio.to_thread(generate_interview_questions, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Interview question generation failed: {exc}",
        ) from exc


@router.post("/generate-answer", response_model=GenerateAnswerResponse)
async def generate_answer_route(data: GenerateAnswerRequest) -> GenerateAnswerResponse:
    try:
        return await asyncio.to_thread(generate_interview_answer, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Interview answer generation failed: {exc}",
        ) from exc


@router.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer_route(data: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
    try:
        return await asyncio.to_thread(evaluate_interview_answer, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Interview answer evaluation failed: {exc}",
        ) from exc


@router.post("/follow-up", response_model=FollowUpResponse)
async def generate_follow_up_route(data: FollowUpRequest) -> FollowUpResponse:
    try:
        return await asyncio.to_thread(generate_follow_up_question, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Interview follow-up generation failed: {exc}",
        ) from exc
