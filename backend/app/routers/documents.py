import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.repositories import document_repo
from app.schemas.document import UploadedDocument
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


@router.get("", response_model=list[UploadedDocument])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return document_repo.list_by_user(db, current_user.id)


@router.post("", response_model=UploadedDocument)
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    doc_type = document_service.validate_upload(file, content)

    relative_path, absolute_path = document_service.build_storage_path(
        current_user.id, file.filename or "upload"
    )
    with open(absolute_path, "wb") as f:
        f.write(content)

    safe_name = document_service.sanitize_filename(file.filename or "upload")
    document = document_repo.create_document(
        db,
        user_id=current_user.id,
        name=safe_name,
        doc_type=doc_type,
        size_bytes=len(content),
        storage_path=relative_path,
    )

    try:
        text = document_service.extract_text(absolute_path, doc_type)
        chunk_count = max(1, (len(text) // (CHUNK_SIZE - CHUNK_OVERLAP)) + 1) if text else 0
        document = document_repo.update_status(
            db, document, status="ready", chunk_count=chunk_count, content_text=text
        )
    except Exception:
        document = document_repo.update_status(db, document, status="error")

    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = document_repo.get_by_id(db, document_id, current_user.id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if os.path.exists(document.storage_path):
        os.remove(document.storage_path)

    document_repo.delete_document(db, document)
    return None
