# Knowledge Assistant

A full-stack knowledge assistant: chat with an AI, upload documents (PDF/TXT), and ask
questions grounded in their content. Built for the Junior Developer 2026 coding assessment.

## Tech Stack

- **Frontend:** Next.js (App Router)
- **Backend:** FastAPI (Python 3.11+)
- **Database:** SQLite (via SQLAlchemy, configurable to PostgreSQL through `DATABASE_URL`)
- **Vector DB:** Not yet implemented (RAG currently uses naive full-document context, see Known Issues)
- **Auth:** JWT (`python-jose`) + `bcrypt`
- **LLM Provider:** OpenAI-compatible API (configurable `OPENAI_BASE_URL`/`OPENAI_MODEL`, e.g. Groq)

## Setup & Run

### Backend (standalone)

```bash
cd backend
cp .env.example .env   # fill in OPENAI_API_KEY, JWT_SECRET, etc.
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --reload
```

The backend seeds a mock user on first startup: `admin / admin123`.

### Full stack (Docker Compose)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health check: http://localhost:8000/health

## Features Done

- [x] Login + Protected Routes (JWT, bcrypt, mock user `admin/admin123`)
- [x] File Upload (PDF/TXT) — extension + MIME sniff + size cap + filename sanitization
- [x] Chat with AI (basic) — timeout + clean error handling
- [x] Chat with Uploaded File Context — naive full-text context injection + citations
- [x] Token Usage Counter — per-message usage + `/usage/session` totals
- [ ] RAG with Vector DB (ChromaDB) — not done yet
- [ ] Streaming response — not done yet
- [ ] Rate limiting — not done yet
- [ ] Unit tests — not done yet

## Architecture

```
Browser (Next.js)
   │  fetch + Bearer JWT
   ▼
FastAPI
   ├── /auth          → JWT issue/verify, bcrypt password check
   ├── /documents     → upload, parse (PDF/TXT), store text
   ├── /chat          → build grounded prompt → call LLM → persist + return usage/citations
   ├── /conversations → CRUD, scoped per user
   └── /usage/session → aggregate token usage
        │
        └── SQLite/PostgreSQL (users, conversations, messages, documents)
```

Backend layering: `routers/` (HTTP) → `services/` (business logic) → `repositories/` (DB access)
→ `models/` (SQLAlchemy) / `schemas/` (Pydantic).

## Known Issues

- RAG is currently naive: the full extracted text of attached documents (truncated to ~6000
  chars per doc) is injected into the system prompt. This works for small documents but does
  not scale to large files and does not do semantic retrieval. A proper ChromaDB-based
  chunking + embedding + retrieval pipeline is the planned next step (Bonus D).
- No streaming responses yet — `/chat` returns a complete response after the LLM call finishes.
- No automated tests yet.
- No rate limiting on `/chat` yet.
- Citations currently point to the start of the document content rather than the specific
  retrieved chunk, since there is no chunk-level retrieval yet.
