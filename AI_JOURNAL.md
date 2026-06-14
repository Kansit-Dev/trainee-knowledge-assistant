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

## Session 11: Wiring frontend to the real backend

**Prompt:** "ตอนนี้ได้แล้ว สั่งให้ลบ mock แล้วเชื่อม front/back จริงยังไงดี" — หลังจาก
screenshot แสดงให้เห็นว่า chat UI ยังตอบกลับด้วย hardcoded string
"(This is a mock answer — wire up the backend to get real document-grounded responses.)"
จาก `lib/mock-data.ts`

**AI Response:** Claude Code สร้าง `lib/api.ts` เป็น typed fetch wrapper ที่ครบสมบูรณ์
(login, getMe, listConversations, createConversation, getConversation, updateConversation,
deleteConversation, listDocuments, uploadDocument, deleteDocument, sendChatMessage,
getSessionUsage) พร้อม JWT attachment จาก localStorage, camelCase normalization,
และ ApiError class สำหรับ error handling จากนั้นแก้ `auth-context.tsx` ให้เรียก
`api.login()` และ `api.getMe()` จริง และแก้ `store.tsx` ทุก function ให้เรียก
backend จริงแทน mock

**My Adjustment:** แนะนำให้ทำทีละขั้น (สร้าง api.ts ก่อน → auth-context → store)
แทนที่จะแก้ทุกไฟล์พร้อมกัน เพื่อให้ debug ง่ายถ้ามีปัญหา และให้ตรวจสอบด้วย
`grep -r 'mock-data'` ก่อนลบไฟล์จริง ยืนยันด้วย `pnpm build` ผ่านก่อน commit

---

## Session 12: ตรวจสอบและแก้ไข docker-compose.yml ที่ผิด

**Prompt:** "docker-compose.yml ที่สร้างมามีปัญหา: (1) depends_on ของ backend ผิด
(2) backend ไม่มี healthcheck (3) NEXT_PUBLIC_API_URL อยู่ผิด service
(4) backend ต้องมี env_file (5) ต้องมี root .env"

**AI Response:** Claude Code แก้ไขไฟล์ทีละจุดตามที่ระบุ — ย้าย `depends_on` ให้ถูก
ทิศทาง (frontend depends on backend), เพิ่ม healthcheck บน backend ที่เรียก `/health`,
ย้าย `NEXT_PUBLIC_API_URL` ไปอยู่ใน frontend service, เพิ่ม `env_file: backend/.env`,
สร้าง root `.env`

**My Adjustment:** Claude Code ยังเขียน `depends_on` แบบผสม list กับ dict ทำให้
YAML invalid — ต้องระบุให้ชัดว่าใช้ mapping syntax (`backend: condition: service_healthy`)
ไม่ใช่ list ผมตรวจ output ก่อน approve ทุกครั้งและปฏิเสธไฟล์ที่ผิด

---

## Session 13: เพิ่ม PostgreSQL service ใน docker-compose

**Prompt:** "เพิ่ม service `db` (postgres:16) พร้อม healthcheck, volume persistent,
DATABASE_URL=postgresql://... เพิ่ม psycopg2-binary ใน requirements.txt,
backend depends_on db: condition: service_healthy รัน docker compose up --build ทดสอบจริง"

**AI Response:** Claude Code เพิ่ม `db` service (postgres:16), named volume
`postgres_data`, healthcheck ด้วย `pg_isready`, เพิ่ม `psycopg2-binary==2.9.10`
ใน requirements.txt, แก้ backend depends_on ให้รอ db healthy ก่อน

**My Adjustment:** พบ bug ระหว่างทาง — `DATABASE_URL: "postgresql://${POSTGRES_USER}:..."`
ใน `environment:` block ของ docker-compose ทำ variable expansion จาก host shell
ไม่ใช่จาก `env_file` ทำให้ password ว่างและ postgres ปฏิเสธ connection
Claude Code แก้โดย hardcode credentials ก่อน แต่ผมสังเกตว่านั่นทำให้ credentials
หลุดเข้า git จึงสั่งให้แก้กลับเป็น `${VAR}` โดยให้ root `.env` อยู่ข้างๆ
`docker-compose.yml` ซึ่ง Compose อ่านอัตโนมัติ

---

## Session 14: สร้าง git repo และ commit แยกเป็นขั้นตอน

**Prompt:** "ยังไม่ได้ push ขึ้น git เลย อยากให้ commit แยกเป็นขั้นตอนตามลำดับ
การพัฒนาที่สมเหตุสมผล ไม่ใช่ commit เดียวรวมทุกอย่าง"

**AI Response:** Claude Code รัน `git init`, ตั้ง user config, แล้ว commit แยก
9 ขั้นตอนโดยใช้ `git add <files>` เจาะจงแต่ละกลุ่ม: frontend scaffold → backend auth
→ conversations → chat/RAG → documents → usage/wiring → Dockerfile →
postgres/compose → docs

**My Adjustment:** พบว่า `.git` directory ที่มีอยู่เดิมไม่สมบูรณ์ (ไม่มี `objects/`
และ `refs/`) เนื่องจาก GitKraken เขียนทับบางส่วน ต้องลบแล้ว `git init` ใหม่
ผมตรวจสอบด้วย `ls -la .git` และ `git cat-file` ก่อนตัดสินใจ ไม่ได้ลบทันทีตามที่
AI แนะนำแรก นอกจากนี้ยังต้องลบ `structure.txt` (node_modules dump 2.8MB)
ออกก่อน commit ด้วย

---

## Session 15: เชื่อมต่อ frontend กับ backend จริง ลบ mock layer

**Prompt:** "grep หา mock-data imports ใน frontend ทั้งหมด ถ้าไม่มีให้ลบ mock-data.ts
แล้วรัน pnpm build ยืนยันว่า build ผ่าน"

**AI Response:** Claude Code รัน `Get-ChildItem` + `Select-String` scan ทุก
`.ts`/`.tsx` ใน `app/`, `components/`, `lib/` ยกเว้น `node_modules` และ `.next`
— ไม่พบ import จาก `mock-data` เลย จากนั้นลบ `frontend/lib/mock-data.ts` แล้วรัน
`pnpm build` ผ่านสำเร็จ (`✓ Compiled successfully`)

**My Adjustment:** ต้องระวังว่า PowerShell ไม่มี `grep` ต้องใช้ `Select-String` แทน
และต้อง exclude `node_modules`/`.next` ออกก่อน scan ไม่งั้นจะค้างนาน ผมแก้ prompt
ให้ระบุ path ที่จะ scan ให้ชัดเจน ไม่ใช่ scan ทั้ง `frontend/` แบบกว้างๆ

---

## Session 16: เพิ่ม rate limiting บน POST /chat

**Prompt:** "เพิ่ม rate limiting สำหรับ POST /chat ใช้ slowapi จำกัด 10 requests
ต่อนาทีต่อ IP ทดสอบจริงโดยส่ง request เกิน 10 ครั้ง ยืนยันว่าได้ 429 response"

**AI Response:** Claude Code เพิ่ม `slowapi` ใน `requirements.txt`, แก้ `main.py`
เพิ่ม `Limiter`, `SlowAPIMiddleware`, และ exception handler สำหรับ `RateLimitExceeded`
return 429 JSON, แก้ `routers/chat.py` เพิ่ม `@limiter.limit("10/minute")` decorator
และ inject `Request` parameter พบ circular import ระหว่างทาง แก้โดยแยก `limiter`
instance ออกเป็น `app/core/limiter.py` แล้ว import จากที่นั่นแทน ทดสอบด้วยการส่ง
11 requests ติดกัน — requests 1-10 ได้ 200, request ที่ 11 ได้ 429 พร้อม
`{"detail": "Rate limit exceeded. Please wait before sending another message."}`

**My Adjustment:** ต้องตรวจสอบว่า `Request` object ถูก inject เป็น parameter แรก
ของ endpoint function จริงๆ (slowapi requirement) และ exception handler ต้องอยู่
ก่อน router registration ใน `main.py` มิฉะนั้น 429 จะ return เป็น HTML แทน JSON
ยืนยันด้วย curl จริงว่าครั้งที่ 11 ได้ 429 response พร้อม JSON body ที่ถูกต้อง
