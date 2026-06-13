from datetime import datetime

from pydantic import BaseModel


class UploadedDocument(BaseModel):
    id: str
    name: str
    type: str
    size_bytes: int
    status: str
    chunk_count: int
    uploaded_at: datetime

    class Config:
        from_attributes = True
