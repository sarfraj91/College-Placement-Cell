from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest
from services.chatbot_service import generate_chat_response
from services.model_loder import get_registry

router = APIRouter(prefix="/ai", tags=["chatbot"])


@router.post("/chat")
def placement_chat(data: ChatRequest):

    try:
        registry = get_registry()

        result = generate_chat_response(
            question=data.question,
            history=data.history,
            registry=registry,
            context=data.context,
            resume_skills=data.resume_skills,
            top_k=data.top_k,
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))