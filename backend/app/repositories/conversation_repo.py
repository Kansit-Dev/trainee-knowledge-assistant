from sqlalchemy.orm import Session, joinedload

from app.models.conversation import Conversation, ConversationDocument
from app.models.message import Message


def list_by_user(db: Session, user_id: str) -> list[Conversation]:
    return (
        db.query(Conversation)
        .options(joinedload(Conversation.documents), joinedload(Conversation.messages))
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )


def get_by_id(db: Session, conversation_id: str, user_id: str) -> Conversation | None:
    return (
        db.query(Conversation)
        .options(joinedload(Conversation.documents), joinedload(Conversation.messages))
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )


def create_conversation(db: Session, user_id: str, title: str | None = None) -> Conversation:
    conversation = Conversation(user_id=user_id, title=title or "New Conversation")
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def update_conversation(
    db: Session,
    conversation: Conversation,
    title: str | None = None,
    document_ids: list[str] | None = None,
) -> Conversation:
    if title is not None:
        conversation.title = title

    if document_ids is not None:
        db.query(ConversationDocument).filter(
            ConversationDocument.conversation_id == conversation.id
        ).delete()
        for doc_id in document_ids:
            db.add(
                ConversationDocument(conversation_id=conversation.id, document_id=doc_id)
            )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, conversation: Conversation) -> None:
    db.delete(conversation)
    db.commit()


def add_message(
    db: Session,
    conversation_id: str,
    role: str,
    content: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    citations: list | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        citations=citations,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # touch conversation updated_at
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        db.add(conversation)
        db.commit()

    return message
