from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.repositories import conversation_repo, document_repo
from app.schemas.chat import ChatRequest, ChatResponse, Citation, MessageOut, Usage
from app.services import llm_service, rag_service

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = conversation_repo.get_by_id(db, payload.conversation_id, current_user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # 1. Persist user message
    conversation_repo.add_message(db, conversation.id, role="user", content=payload.message)

    # 2. Build RAG context if document_ids provided
    documents = document_repo.get_many_by_ids(db, payload.document_ids, current_user.id)
    messages, citation_candidates = rag_service.build_messages(payload.message, documents)

    # 3. Call LLM with timeout + error handling
    result = await llm_service.chat_completion(messages)

    # 4. Persist assistant message with usage + citations
    citations = [Citation(**c) for c in citation_candidates] if citation_candidates else None
    assistant_message = conversation_repo.add_message(
        db,
        conversation.id,
        role="assistant",
        content=result["content"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
        total_tokens=result["total_tokens"],
        citations=[c.model_dump() for c in citations] if citations else None,
    )

    return ChatResponse(
        message=MessageOut(
            id=assistant_message.id,
            role=assistant_message.role,
            content=assistant_message.content,
            createdAt=assistant_message.created_at,
            usage=Usage(
                promptTokens=result["prompt_tokens"],
                completionTokens=result["completion_tokens"],
                totalTokens=result["total_tokens"],
            ),
            citations=citations,
        )
    )
