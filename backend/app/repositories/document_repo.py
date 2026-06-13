from sqlalchemy.orm import Session

from app.models.document import Document


def list_by_user(db: Session, user_id: str) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.user_id == user_id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )


def get_by_id(db: Session, document_id: str, user_id: str) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == user_id)
        .first()
    )


def get_many_by_ids(db: Session, document_ids: list[str], user_id: str) -> list[Document]:
    if not document_ids:
        return []
    return (
        db.query(Document)
        .filter(Document.id.in_(document_ids), Document.user_id == user_id)
        .all()
    )


def create_document(
    db: Session,
    user_id: str,
    name: str,
    doc_type: str,
    size_bytes: int,
    storage_path: str,
) -> Document:
    document = Document(
        user_id=user_id,
        name=name,
        type=doc_type,
        size_bytes=size_bytes,
        status="processing",
        storage_path=storage_path,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def update_status(
    db: Session,
    document: Document,
    status: str,
    chunk_count: int = 0,
    content_text: str | None = None,
) -> Document:
    document.status = status
    document.chunk_count = chunk_count
    if content_text is not None:
        document.content_text = content_text
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def delete_document(db: Session, document: Document) -> None:
    db.delete(document)
    db.commit()
