from app.models.document import Document

MAX_CONTEXT_CHARS_PER_DOC = 6000


def build_messages(message: str, documents: list[Document]) -> tuple[list[dict], list[dict]]:
    """Build chat messages with document context injected, plus citation candidates.

    Returns (messages, citation_candidates) where citation_candidates is a list of
    {document_id, document_name, snippet} for documents that were used as context.
    """
    if not documents:
        messages = [
            {
                "role": "system",
                "content": "You are a helpful knowledge assistant. Answer the user's question clearly and concisely.",
            },
            {"role": "user", "content": message},
        ]
        return messages, []

    context_blocks = []
    citations = []
    for doc in documents:
        text = (doc.content_text or "")[:MAX_CONTEXT_CHARS_PER_DOC]
        if not text.strip():
            continue
        context_blocks.append(f"### Document: {doc.name}\n{text}")
        snippet = text[:300].strip()
        citations.append(
            {
                "id": doc.id,
                "documentId": doc.id,
                "documentName": doc.name,
                "snippet": snippet,
                "page": None,
            }
        )

    context_text = "\n\n".join(context_blocks)

    system_prompt = (
        "You are a helpful knowledge assistant. Answer the user's question using the "
        "provided document context when relevant. If the answer is not in the context, "
        "say so and answer from general knowledge.\n\n"
        f"Context:\n{context_text}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]
    return messages, citations
