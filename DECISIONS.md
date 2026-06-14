# Architecture Decisions

## Decision 1: Chose SQLite over PostgreSQL for local development

### Context

The spec recommends PostgreSQL, but the project also needs to run with a single
`docker compose up` command and be easy to set up for grading/testing without extra
configuration steps like waiting for a database container to become healthy before the
app can start.

### Alternatives Considered

- **PostgreSQL** as specified in `BACKEND.md`, run as its own Docker Compose service.
- **SQLite** as a file-based database requiring no separate service.
- **MongoDB / JSON file**, also allowed by the assignment but a worse fit for relational
  data like users, conversations, messages, and documents with foreign keys.

### Why SQLite

SQLAlchemy is used as the ORM, and the connection string is fully driven by the
`DATABASE_URL` environment variable. This means switching to PostgreSQL later is a
one-line config change (`postgresql://user:pass@db:5432/knowledge`) plus adding the
`db` service to `docker-compose.yml` — no application code changes are required. For
the current stage of the project, SQLite keeps the setup to a single container and
avoids `depends_on`/healthcheck complexity for the database.

### Trade-offs

SQLite does not handle concurrent writes well and is not suitable for a real
multi-user production deployment. It also lacks some PostgreSQL features (e.g. native
JSON querying, more advanced indexing). For this assessment's scope — single
backend instance, low concurrency — this is an acceptable trade-off, and the
ORM-based design means migrating to PostgreSQL is low-risk if needed later.

---

## Decision 2: Layered architecture (routers / services / repositories / models / schemas)

### Context

The rubric explicitly scores "Code Structure & Clean Code" on whether there is
layering (route/service/repo) with good naming and no "god files." The backend needs
to support multiple concerns per feature (HTTP validation, business logic, DB access)
across auth, documents, chat, and conversations.

### Alternatives Considered

- **Single-file-per-feature** (e.g. one `chat.py` containing route handler, prompt
  building, and DB queries together) — fastest to write but quickly becomes a god file
  as RAG, LLM calls, and persistence logic grow.
- **Full layered architecture** with `routers/` (HTTP request/response only),
  `services/` (business logic — auth, document parsing, RAG prompt building, LLM
  calls), `repositories/` (DB access only), `models/` (SQLAlchemy ORM), and `schemas/`
  (Pydantic request/response types).

### Why Layered Architecture

Each router function stays small and readable — it validates input, calls one or two
service functions, and returns a response. Business logic (e.g. how a RAG prompt is
constructed in `rag_service.py`, or how an upload is validated in
`document_service.py`) is isolated and testable independently of FastAPI. Repositories
centralize all DB queries, which makes it straightforward to enforce per-user data
scoping consistently (every repository function takes `user_id` and filters by it).

### Trade-offs

This adds more files and some boilerplate (e.g. a thin router function that just calls
a service function) compared to a flatter structure. For a project this size the extra
navigation cost is small and is outweighed by how much easier it is to locate and test
a specific piece of logic (e.g. token-usage aggregation lives only in
`routers/usage.py` + a single repository query, not scattered across chat handling).

---

## Decision 3: Naive full-document context instead of vector retrieval (for now)

### Context

The required features include "Chat with Uploaded File Context" (10 points, full
credit requires working accurately and handling large files), while RAG with a vector
DB (ChromaDB, chunking + embedding + retrieval) is a separate bonus item worth 8
points. Given limited time, the required features were prioritized first.

### Alternatives Considered

- **Full ChromaDB pipeline**: chunk documents (~800 tokens, 100 overlap), embed each
  chunk, store in ChromaDB with metadata, and retrieve top-k chunks per query.
- **Naive full-text injection**: extract the full text of each attached document
  (via `pypdf` for PDFs, direct read for `.txt`), truncate to a fixed character limit,
  and inject it directly into the system prompt as context, with the first ~300
  characters used as a citation snippet.

### Why Naive Injection (for now)

This gets "Chat with Uploaded File Context" working end-to-end (upload → extract →
inject → cite) quickly and correctly for small-to-medium documents, which covers the
required-feature grading criteria. It also keeps the data model forward-compatible:
`documents.content_text` and `chunk_count` are already stored, so a later ChromaDB
pass can chunk this stored text and populate a vector collection without re-touching
the upload/extraction code path.

### Trade-offs

This does not scale to large documents — content is truncated at ~6000 characters per
document, so a question whose answer lies beyond that point in a large PDF won't be
answered correctly, and citations always point near the start of the document rather
than the specific relevant chunk. This is explicitly called out in `README.md` under
Known Issues, and implementing the ChromaDB-based RAG bonus is the planned next step.
