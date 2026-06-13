import os
import re
import uuid

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".txt"}
ALLOWED_MIME_TYPES = {
    ".pdf": {"application/pdf"},
    ".txt": {"text/plain", "application/octet-stream"},
}


def sanitize_filename(filename: str) -> str:
    """Strip directory components and unsafe characters to prevent path traversal."""
    name = os.path.basename(filename)
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name or "file"


def validate_upload(file: UploadFile, content: bytes) -> str:
    """Validate extension, size, and sniff content type. Returns normalized type ('pdf'|'txt')."""
    filename = sanitize_filename(file.filename or "")
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .pdf and .txt files are allowed",
        )

    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {settings.max_upload_mb}MB",
        )

    # Sniff content type
    if ext == ".pdf":
        if not content.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match .pdf extension",
            )
        doc_type = "pdf"
    else:
        # .txt: best-effort check it's valid text (decodable, no PDF magic bytes)
        if content.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match .txt extension",
            )
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File does not appear to be valid text",
            )
        doc_type = "txt"

    return doc_type


def build_storage_path(user_id: str, filename: str) -> tuple[str, str]:
    """Return (relative_storage_path, absolute_path) for saving an upload."""
    safe_name = sanitize_filename(filename)
    unique_name = f"{uuid.uuid4()}_{safe_name}"
    user_dir = os.path.join(settings.upload_dir, user_id)
    os.makedirs(user_dir, exist_ok=True)
    relative_path = os.path.join(user_dir, unique_name)
    return relative_path, relative_path


def extract_text(storage_path: str, doc_type: str) -> str:
    """Extract plain text content from a stored file."""
    if doc_type == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(storage_path)
        pages_text = []
        for page in reader.pages:
            pages_text.append(page.extract_text() or "")
        return "\n".join(pages_text)
    else:
        with open(storage_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
