from datetime import datetime

from pydantic import BaseModel


class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    document_ids: list[str] = []


class Usage(BaseModel):
    promptTokens: int
    completionTokens: int
    totalTokens: int


class Citation(BaseModel):
    id: str
    documentId: str
    documentName: str
    snippet: str
    page: int | None = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    createdAt: datetime
    usage: Usage | None = None
    citations: list[Citation] | None = None


class ChatResponse(BaseModel):
    message: MessageOut


class SessionUsage(BaseModel):
    promptTokens: int
    completionTokens: int
    totalTokens: int
