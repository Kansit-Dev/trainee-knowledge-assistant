import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.models.user import User
from app.repositories import conversation_repo, document_repo
from app.schemas.chat import ChatRequest, ChatResponse, Citation, MessageOut, Usage
from app.services import llm_service, rag_service

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    payload: ChatRequest,
    stream: bool = Query(False, description="Set to true to receive a Server-Sent Events stream"),
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

    # ------------------------------------------------------------------ #
    #  STREAMING PATH                                                      #
    # ------------------------------------------------------------------ #
    if stream:
        # Eagerly capture plain Python values — SQLAlchemy session expires
        # before the async generator body runs, so lazy attribute access fails.
        conversation_id_str: str = conversation.id
        citations = [Citation(**c) for c in citation_candidates] if citation_candidates else None

        async def event_generator():
            """Async generator that yields SSE-formatted chunks then a final [DONE] event."""
            full_content_parts: list[str] = []

            # Stream each token from the LLM as an SSE data event
            async for chunk in llm_service.stream_chat_completion(messages):
                full_content_parts.append(chunk)
                # Yield each character individually as requested
                for char in chunk:
                    yield f"data: {char}\n\n"

            # After streaming completes, persist the full assistant message
            full_content = "".join(full_content_parts)
            assistant_message = conversation_repo.add_message(
                db,
                conversation_id_str,
                role="assistant",
                content=full_content,
                prompt_tokens=0,        # usage not available in streaming mode
                completion_tokens=0,
                total_tokens=0,
                citations=[c.model_dump() for c in citations] if citations else None,
            )

            # Final SSE event: [DONE] with usage + citations metadata
            done_payload = json.dumps(
                {
                    "message_id": assistant_message.id,
                    "usage": {
                        "promptTokens": 0,
                        "completionTokens": 0,
                        "totalTokens": 0,
                    },
                    "citations": [c.model_dump() for c in citations] if citations else [],
                }
            )
            yield f"data: [DONE] {done_payload}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",   # disable nginx buffering
            },
        )

    # ------------------------------------------------------------------ #
    #  NON-STREAMING PATH  (unchanged behaviour)                          #
    # ------------------------------------------------------------------ #

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
