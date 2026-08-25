from fastapi import APIRouter, Depends, HTTPException
from app.schemas.chat import ChatRequest, ChatResponse
from app.ai.assistant import get_ai_response
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_active_user),
):
    """AI HR Assistant — receives controlled context, never exposes raw API keys to frontend."""
    try:
        reply, model_used = await get_ai_response(
            message=payload.message,
            employee_context=payload.employee_context,
            prediction_context=payload.prediction_context,
            conversation_history=payload.conversation_history or [],
        )
        return ChatResponse(reply=reply, model_used=model_used)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
