import asyncio

from fastapi import APIRouter, HTTPException

from models.schemas import (
    MockInterviewFinishRequest,
    MockInterviewFinishResponse,
    MockInterviewNextRequest,
    MockInterviewNextResponse,
    MockInterviewStartRequest,
    MockInterviewStartResponse,
)
from services.mock_interview_service import (
    continue_mock_interview,
    finish_mock_interview,
    start_mock_interview,
)


router = APIRouter(prefix="/ai/mock-interview", tags=["mock-interview"])


@router.post("/start", response_model=MockInterviewStartResponse)
async def start_mock_interview_route(data: MockInterviewStartRequest) -> MockInterviewStartResponse:
    try:
        return await asyncio.to_thread(start_mock_interview, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Mock interview start failed: {exc}",
        ) from exc


@router.post("/next", response_model=MockInterviewNextResponse)
async def continue_mock_interview_route(data: MockInterviewNextRequest) -> MockInterviewNextResponse:
    try:
        return await asyncio.to_thread(continue_mock_interview, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Mock interview next turn failed: {exc}",
        ) from exc


@router.post("/finish", response_model=MockInterviewFinishResponse)
async def finish_mock_interview_route(data: MockInterviewFinishRequest) -> MockInterviewFinishResponse:
    try:
        return await asyncio.to_thread(finish_mock_interview, data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Mock interview finish failed: {exc}",
        ) from exc
