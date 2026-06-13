from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.repositories import conversation_repo
from app.schemas.conversation import ConversationCreate, ConversationOut, ConversationUpdate
from app.schemas.chat import MessageOut, Usage

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _to_out(conversation) -> ConversationOut:
    messages = [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            createdAt=m.created_at,
            usage=Usage(
                promptTokens=m.prompt_tokens,
                completionTokens=m.completion_tokens,
                totalTokens=m.total_tokens,
            )
            if m.role == "assistant"
            else None,
            citations=m.citations,
        )
        for m in conversation.messages
    ]
    document_ids = [cd.document_id for cd in conversation.documents]
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        createdAt=conversation.created_at,
        updatedAt=conversation.updated_at,
        documentIds=document_ids,
        messages=messages,
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = conversation_repo.list_by_user(db, current_user.id)
    return [_to_out(c) for c in conversations]


@router.post("", response_model=ConversationOut)
def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = conversation_repo.create_conversation(db, current_user.id, payload.title)
    return _to_out(conversation)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = conversation_repo.get_by_id(db, conversation_id, current_user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return _to_out(conversation)


@router.patch("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = conversation_repo.get_by_id(db, conversation_id, current_user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conversation = conversation_repo.update_conversation(
        db, conversation, title=payload.title, document_ids=payload.documentIds
    )
    conversation = conversation_repo.get_by_id(db, conversation_id, current_user.id)
    return _to_out(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = conversation_repo.get_by_id(db, conversation_id, current_user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conversation_repo.delete_conversation(db, conversation)
    return None
