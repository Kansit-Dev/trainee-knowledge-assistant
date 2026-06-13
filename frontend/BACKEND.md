# Backend Implementation Guide — Knowledge Assistant

This document describes everything the **FastAPI** backend must implement so the
existing Next.js frontend can drop its mock layer and talk to a real API.

> The frontend currently runs **fully mocked**. All fake logic lives in
> `lib/mock-data.ts`, `lib/auth-context.tsx`, and `lib/store.tsx`. When the
> backend is ready, swap those mock calls for `fetch()` calls (see
> [Frontend integration](#frontend-integration)).

---

## 1. Tech Stack (target)

| Layer        | Choice                                  |
| ------------ | --------------------------------------- |
| Frontend     | Next.js 16 (App Router)                 |
| Backend      | FastAPI (Python 3.11+)                  |
| Database     | PostgreSQL                              |
| Vector DB    | ChromaDB                                |
| Auth         | JWT (`python-jose`) + `bcrypt`          |
| LLM provider | OpenAI / Claude / any free alternative  |
| Deploy       | Docker Compose (`docker compose up`)    |

---

## 2. High-level architecture

```
Browser (Next.js)
   │  fetch + Bearer JWT
   ▼
FastAPI
   ├── /auth        → JWT issue/verify, bcrypt password check
   ├── /documents   → upload, parse (PDF/TXT), chunk, embed → ChromaDB
   ├── /chat        → retrieve relevant chunks (RAG) → call LLM → stream
   └── /conversations → CRUD persisted in PostgreSQL
        │
        ├── PostgreSQL  (users, conversations, messages, documents, usage)
        └── ChromaDB    (chunk embeddings, metadata: doc_id, page, chunk_idx)
```

Recommended layering (matches the "Code Structure" rubric):

```
backend/
  app/
    main.py            # FastAPI app + router registration + CORS
    core/
      config.py        # env settings (pydantic-settings)
      security.py      # JWT encode/decode, bcrypt hashing
      deps.py          # get_current_user, get_db dependencies
    routers/           # HTTP layer only (request/response)
      auth.py
      documents.py
      chat.py
      conversations.py
    services/          # business logic
      auth_service.py
      document_service.py   # parse + chunk + embed
      rag_service.py        # retrieval + prompt building
      llm_service.py        # provider calls + token accounting
    repositories/      # DB access only
      user_repo.py
      conversation_repo.py
      document_repo.py
    models/            # SQLAlchemy models
    schemas/           # Pydantic request/response models
```

---

## 3. Environment variables

```env
# Auth
JWT_SECRET=change-me                 # used to sign tokens
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Database
DATABASE_URL=postgresql://user:pass@db:5432/knowledge

# Vector DB
CHROMA_HOST=chroma
CHROMA_PORT=8000

# LLM provider (pick one)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=...
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# Limits
MAX_UPLOAD_MB=10
```

Never hardcode keys. Load via `pydantic-settings`. CORS must allow only the
frontend origin.

---

## 4. Data model (PostgreSQL)

```sql
users (
  id            UUID PK,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,      -- bcrypt
  display_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

documents (
  id          UUID PK,
  user_id     UUID FK -> users.id,
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('pdf','txt')),
  size_bytes  BIGINT,
  status      TEXT CHECK (status IN ('processing','ready','error')),
  chunk_count INT DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

conversations (
  id          UUID PK,
  user_id     UUID FK -> users.id,
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- documents attached to a conversation as RAG context
conversation_documents (
  conversation_id UUID FK,
  document_id     UUID FK,
  PRIMARY KEY (conversation_id, document_id)
);

messages (
  id               UUID PK,
  conversation_id  UUID FK -> conversations.id,
  role             TEXT CHECK (role IN ('user','assistant')),
  content          TEXT,
  prompt_tokens    INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens     INT DEFAULT 0,
  citations        JSONB,           -- [{document_id, document_name, snippet, page}]
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

ChromaDB stores one collection per user (or one global collection filtered by
`user_id`). Each embedded chunk carries metadata: `document_id`, `document_name`,
`page`, `chunk_index`.

---

## 5. REST API contract

All endpoints except `/auth/login` require `Authorization: Bearer <jwt>`.
Shapes match the TypeScript interfaces in `lib/types.ts`.

### Auth

| Method | Path           | Body                          | Response                          |
| ------ | -------------- | ----------------------------- | --------------------------------- |
| POST   | `/auth/login`  | `{ username, password }`      | `{ access_token, user }`          |
| GET    | `/auth/me`     | —                             | `{ user }` (validates JWT)        |

- Verify password with `bcrypt.checkpw`.
- Issue JWT with `sub = user.id`, `exp` claim.
- Seed a mock user `admin / admin123` (bcrypt-hashed) for the demo.

### Documents

| Method | Path                 | Body / Params                   | Response               |
| ------ | -------------------- | ------------------------------- | ---------------------- |
| GET    | `/documents`         | —                               | `UploadedDocument[]`   |
| POST   | `/documents`         | `multipart/form-data` (`file`)  | `UploadedDocument`     |
| DELETE | `/documents/{id}`    | —                               | `204`                  |

Upload handler MUST:
1. Validate extension is `.pdf` or `.txt` **and** sniff the content type.
2. Reject files over `MAX_UPLOAD_MB`.
3. Sanitize the filename / never trust the client path (prevent path traversal).
4. Parse text (`pypdf` for PDF), chunk (e.g. ~800 tokens, 100 overlap),
   embed each chunk, and upsert into ChromaDB.
5. Persist the row with `status='ready'` and the real `chunk_count` when done.
   Return `status='processing'` immediately if you process async.

### Chat

| Method | Path        | Body                                                       |
| ------ | ----------- | ---------------------------------------------------------- |
| POST   | `/chat`     | `{ conversation_id, message, document_ids: string[] }`    |

Behavior:
1. Persist the user message.
2. If `document_ids` is non-empty → **RAG**: embed the query, retrieve top-k
   chunks from ChromaDB filtered by those doc ids, build a grounded prompt.
3. Call the LLM. **Set a request timeout** and handle provider errors gracefully
   (return a clean 4xx/5xx, never leak stack traces).
4. Read real token counts from the provider's `usage` field.
5. Persist the assistant message with `usage` + `citations`.

**Response — non-streaming:**
```json
{
  "message": {
    "id": "…",
    "role": "assistant",
    "content": "…",
    "createdAt": "…",
    "usage": { "promptTokens": 86, "completionTokens": 44, "totalTokens": 130 },
    "citations": [
      { "id": "…", "documentId": "…", "documentName": "leave-policy.txt",
        "snippet": "…", "page": 1 }
    ]
  }
}
```

**Response — streaming (bonus C):** stream Server-Sent Events / chunked text.
Send a final event containing the `usage` + `citations` once generation ends.
The frontend already renders token-by-token, so SSE maps cleanly onto it.

### Conversations

| Method | Path                     | Body                  | Response          |
| ------ | ------------------------ | --------------------- | ----------------- |
| GET    | `/conversations`         | —                     | `Conversation[]`  |
| POST   | `/conversations`         | `{ title? }`          | `Conversation`    |
| GET    | `/conversations/{id}`    | —                     | `Conversation`    |
| PATCH  | `/conversations/{id}`    | `{ title?, documentIds? }` | `Conversation` |
| DELETE | `/conversations/{id}`    | —                     | `204`             |

Every query MUST be scoped by the authenticated `user_id` (a user can only see
their own conversations/documents).

---

## 6. Token usage

- Always take counts from the **provider response usage object** — do not estimate
  on the server for the final number (the frontend estimate in
  `lib/mock-data.ts::estimateTokens` is a placeholder only).
- Return per-message `usage`. The frontend sums them client-side for the
  "Session tokens" meter, but you should also expose a totals endpoint if you
  want server-authoritative numbers:
  `GET /usage/session → { promptTokens, completionTokens, totalTokens }`.

---

## 7. Security checklist (maps to the rubric)

- [ ] Passwords hashed with bcrypt, never stored or logged in plaintext.
- [ ] JWT signed with a secret from env; verify signature + expiry on every request.
- [ ] CORS restricted to the known frontend origin.
- [ ] Upload validation: extension + MIME sniff + size cap + filename sanitization.
- [ ] All DB access parameterized (use SQLAlchemy / asyncpg params — no string SQL).
- [ ] Per-user data scoping on every query.
- [ ] No API keys in source; rate-limit `/chat` (bonus F).
- [ ] Errors return clean JSON, never raw tracebacks.

---

## 8. Docker Compose (target)

`docker compose up` must boot everything:

```yaml
services:
  frontend:   # Next.js
  backend:    # FastAPI (uvicorn)
  db:         # postgres:16
  chroma:     # chromadb/chroma
```

Add healthchecks (bonus G) and `depends_on: { db: { condition: service_healthy } }`.

---

## 9. Frontend integration

When the backend is live, replace the mock layer:

1. **`lib/api.ts`** — create a typed `fetch` wrapper that attaches the JWT and
   points at `NEXT_PUBLIC_API_URL`.
2. **`lib/auth-context.tsx`** — `login()` should `POST /auth/login`, store the
   returned `access_token`, and hydrate via `GET /auth/me`.
3. **`lib/store.tsx`** — replace:
   - `createConversation` → `POST /conversations`
   - `deleteConversation` → `DELETE /conversations/{id}`
   - `sendMessage`        → `POST /chat` (or SSE stream)
   - `attachDocument`     → `POST /documents` (multipart)
   - `removeDocument`     → `DELETE /documents/{id}`
   - `toggleDocumentOnConversation` → `PATCH /conversations/{id}`
4. Delete `lib/mock-data.ts` once nothing imports it.

The UI types in `lib/types.ts` are the single source of truth — keep the API
responses aligned with them and the frontend needs no other changes.

---

## 10. Suggested build order

1. Auth (login + JWT + `get_current_user` dependency).
2. Conversations + messages CRUD (no AI yet).
3. Basic chat → LLM call with timeout + token usage.
4. Document upload + parse + chunk + embed.
5. RAG: retrieval + grounded prompt + citations.
6. Streaming, rate limiting, healthchecks, tests (bonuses).
