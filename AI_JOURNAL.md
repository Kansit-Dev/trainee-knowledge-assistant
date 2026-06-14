# AI Usage Journal

## Session 1: Scaffolding the FastAPI backend structure

**Prompt:** "ทำตาม BACKEND.md ได้เลยไหม" (after reviewing the existing frontend mock
and `BACKEND.md` spec)

**AI Response:** Claude reviewed the existing project structure, found an empty
`backend/app/{core,routers,services,repositories,models,schemas}` directory (a leftover
from a failed brace-expansion command), cleaned it up, and proposed building Required
Features 1–5 first (no RAG/streaming) before bonuses.

**My Adjustment:** Confirmed scope — required features only for now — and provided the
LLM provider config (Groq's OpenAI-compatible endpoint with `llama-3.3-70b-versatile`).

---

## Session 2: Core config, security, and database setup

**Prompt:** (continuation of Session 1 — build out `app/core/config.py`,
`security.py`, `database.py`)

**AI Response:** Claude created `pydantic-settings`-based config loading all env vars
from `BACKEND.md` (JWT secret/algorithm, database URL, OpenAI-compatible provider
settings, CORS origin, upload limits), a security module wrapping `passlib`/`bcrypt`
for password hashing and `python-jose` for JWT encode/decode, and a SQLAlchemy
engine/session setup defaulting to SQLite but driven entirely by `DATABASE_URL`.

**My Adjustment:** None needed at this stage — accepted as written.

---

## Session 3: SQLAlchemy models for users, documents, conversations, messages

**Prompt:** (continuation — implement the data model from `BACKEND.md` section 4)

**AI Response:** Claude created `User`, `Document`, `Conversation`,
`ConversationDocument`, and `Message` models matching the SQL schema in `BACKEND.md`,
using UUID string primary keys, relationships with cascade deletes, and a `JSON` column
for message citations.

**My Adjustment:** None — matched the spec directly.

---

## Session 4: Auth — JWT issue/verify, bcrypt, protected routes

**Prompt:** (continuation — implement `/auth/login` and `/auth/me`)

**AI Response:** Claude built `auth_service.py` (authenticate + issue token),
`core/deps.py` (`get_current_user` dependency using `OAuth2PasswordBearer`), and
`routers/auth.py`. The app seeds a mock `admin/admin123` user (bcrypt-hashed) on
startup as required.

**My Adjustment:** None at this stage.

---

## Session 5: Debugging bcrypt/passlib version error during testing

**Prompt:** (Claude ran the server itself to test `/auth/login` and hit a startup
error)

**AI Response:** Claude found `(trapped) error reading bcrypt version` from
`passlib` + `bcrypt 4.2.1` incompatibility, which caused user-seeding to crash the
server on startup. Claude downgraded to `bcrypt==4.0.1` in `requirements.txt` and
re-tested — login then worked and returned a valid JWT.

**My Adjustment:** Accepted the pinned version; this is recorded in `requirements.txt`.

---

## Session 6: Documents — upload validation, sanitization, text extraction

**Prompt:** (continuation — implement `/documents` per `BACKEND.md` section: extension
+ MIME sniff + size cap + filename sanitization + pypdf extraction)

**AI Response:** Claude implemented `document_service.py` with
`sanitize_filename` (path-traversal-safe), `validate_upload` (checks extension, size
against `MAX_UPLOAD_MB`, and sniffs file content — `%PDF` magic bytes for PDFs, UTF-8
decodability for `.txt`), and `extract_text` (pypdf for PDF, direct read for `.txt`).
The router stores the file under `uploads/{user_id}/`, persists a `Document` row, then
extracts text and updates `status`/`chunk_count`/`content_text`.

**My Adjustment:** None — tested directly via curl, both valid `.txt` upload and an
invalid `.exe` upload (correctly rejected with 400) worked as expected.

---

## Session 7: Chat — LLM service, RAG prompt building, citations, token usage

**Prompt:** (continuation — implement `/chat` per `BACKEND.md`: persist user message,
RAG if `document_ids` present, call LLM with timeout, persist assistant message with
real usage + citations)

**AI Response:** Claude implemented `llm_service.py` (async httpx call to an
OpenAI-compatible `/chat/completions` endpoint, 30s timeout, clean 502/504 errors with
no leaked stack traces, parses `usage` from the provider response), `rag_service.py`
(builds a system prompt injecting up to ~6000 chars per attached document's stored
text, and returns citation candidates with a snippet), and `routers/chat.py` wiring it
all together plus persisting both messages via `conversation_repo`.

**My Adjustment:** None — this is the naive-RAG approach documented as a known
limitation in `DECISIONS.md` (Decision 3), to be replaced with ChromaDB-based retrieval
later.

---

## Session 8: Conversations CRUD + session usage endpoint + app wiring

**Prompt:** (continuation — implement `/conversations` CRUD scoped per user, and
`GET /usage/session`)

**AI Response:** Claude implemented `conversation_repo.py` and `routers/conversations.py`
with full CRUD (list/create/get/patch/delete), all queries filtered by
`Conversation.user_id`. `routers/usage.py` aggregates `prompt_tokens`/
`completion_tokens`/`total_tokens` across all of a user's messages via a SQL `SUM`.
`main.py` wires up CORS (restricted to `FRONTEND_ORIGIN`), a global exception handler
that returns `{"detail": "Internal server error"}` instead of stack traces, and
startup-time table creation + admin user seeding.

**My Adjustment:** None.

---

## Session 9: End-to-end testing and git history

**Prompt:** (Claude ran the full server itself and tested every endpoint)

**AI Response:** Claude started the server, ran the full flow via curl: login →
`/auth/me` → create conversation → list conversations → upload `.txt`/invalid file →
chat without documents (against a local mock LLM server since the sandbox can't reach
Groq's API) → chat with a document attached (citations + usage returned correctly) →
`/usage/session` totals. All endpoints behaved as expected. Claude then split the
backend code into 7 logical git commits (scaffold → auth → conversations → chat →
documents → usage/wiring → Dockerfile) for clean commit history.

**My Adjustment:** Provided a real Groq API key for one live test; Claude correctly
flagged it as a secret and used only a placeholder in `.env.example`, recommending the
key be rotated since it was shared in chat.

---

## Session 10: Docker Compose for frontend + backend

**Prompt:** "ช่วยสร้าง docker-compose.yml ที่ root... backend (FastAPI, healthcheck
`/health`, `env_file: backend/.env`)... frontend (Next.js, Dockerfile ใหม่,
`NEXT_PUBLIC_API_URL=http://backend:8000`, `depends_on: condition: service_healthy`)...
รัน `docker compose up --build` จริง"

**AI Response:** This was run via Claude Code (not this assistant) on the user's local
machine. The first attempt produced an invalid `docker-compose.yml` (backend had
`depends_on: [frontend]` reversed, `NEXT_PUBLIC_API_URL` placed on the wrong service,
no backend healthcheck, and a malformed `depends_on` mixing list and mapping syntax for
the frontend service — invalid YAML).

**My Adjustment:** I (as a separate Claude session) reviewed the proposed compose file,
identified all five structural errors, and gave a corrected prompt specifying the exact
correct `depends_on`/`healthcheck`/`env_file`/`environment` placement for each service,
plus required raw `docker compose ps` / `docker compose logs` / `curl` output (not a
prose summary) to verify it actually ran.

---

## Session 11: Wiring frontend to the real backend (in progress)

**Prompt:** "เดี๋ยวนะ, ตอนนี้ได้ละสั่งให้ลบ mock ละเชื่อม front/back จริงยังไงดี" — after a
screenshot showed the chat UI still returning a hardcoded "(This is a mock answer —
wire up the backend to get real document-grounded responses.)" string from
`lib/mock-data.ts`.

**AI Response:** Recommended NOT deleting the mock layer immediately. Instead: (1)
verify the real backend answers correctly via direct curl first, (2) create
`lib/api.ts` as a typed fetch wrapper without touching other files, (3) switch
`auth-context.tsx` to use it and test login via the UI, (4) switch `store.tsx`
function-by-function (`createConversation` → `attachDocument` → `sendMessage` → rest),
testing after each, and only then (5) `grep` for remaining `mock-data` imports and
delete the file once unused.

**My Adjustment:** In progress — `lib/api.ts` creation is the next step to be run via
Claude Code on the local project.
