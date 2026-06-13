import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    documents = relationship(
        "ConversationDocument", back_populates="conversation", cascade="all, delete-orphan"
    )


class ConversationDocument(Base):
    __tablename__ = "conversation_documents"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id"), primary_key=True
    )
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id"), primary_key=True
    )

    conversation = relationship("Conversation", back_populates="documents")
    document = relationship("Document")
