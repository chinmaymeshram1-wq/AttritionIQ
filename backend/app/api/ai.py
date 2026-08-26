from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.chat import ChatRequest, ChatResponse
from app.ai.assistant import get_ai_response
from app.auth.dependencies import get_current_active_user
from app.models.user import User
import logging

logger = logging.getLogger("attritioniq")
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
        err_msg = f"AI service error ({type(e).__name__}): {str(e)}"
        print(f"[AI] Error handling /chat request: {err_msg}", flush=True)
        logger.error(f"[AI] Error handling /chat request: {err_msg}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err_msg)
