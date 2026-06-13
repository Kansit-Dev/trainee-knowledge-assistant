from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import SessionUsage

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/session", response_model=SessionUsage)
def session_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    totals = (
        db.query(
            func.coalesce(func.sum(Message.prompt_tokens), 0),
            func.coalesce(func.sum(Message.completion_tokens), 0),
            func.coalesce(func.sum(Message.total_tokens), 0),
        )
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(Conversation.user_id == current_user.id)
        .first()
    )

    prompt_tokens, completion_tokens, total_tokens = totals or (0, 0, 0)
    return SessionUsage(
        promptTokens=prompt_tokens,
        completionTokens=completion_tokens,
        totalTokens=total_tokens,
    )
