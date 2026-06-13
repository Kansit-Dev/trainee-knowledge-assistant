from datetime import datetime

from pydantic import BaseModel

from app.schemas.chat import MessageOut


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationUpdate(BaseModel):
    title: str | None = None
    documentIds: list[str] | None = None


class ConversationOut(BaseModel):
    id: str
    title: str | None = None
    createdAt: datetime
    updatedAt: datetime
    documentIds: list[str] = []
    messages: list[MessageOut] = []

    class Config:
        from_attributes = True
