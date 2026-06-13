# Knowledge Assistant

A ChatGPT-style **Mini Knowledge Assistant** frontend. This is the **frontend draft**:
the full UI is built and interactive, but it runs on a **mock data layer** — no real
API/LLM is connected yet. See [`BACKEND.md`](./BACKEND.md) for the full contract the
FastAPI backend must implement to make this real.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Markdown:** `react-markdown` + `remark-gfm`
- **Planned backend:** FastAPI (Python) · PostgreSQL · ChromaDB · JWT auth (bcrypt)

## Setup & Run

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Log in with the demo credentials: **`admin` / `admin123`**.

> The future production target is a single `docker compose up` (frontend + FastAPI +
> Postgres + Chroma). That is documented in `BACKEND.md` and not part of this draft.

## Features (frontend draft status)

- [x] **Login + Protected Routes** — mock auth (`admin/admin123`), session-guarded `/chat`
- [x] **File Upload (PDF/TXT)** — client-side type + size validation, simulated processing
- [x] **Chat with AI (basic)** — mocked streaming responses + typing indicator
- [x] **Chat with Uploaded File Context** — attach documents as context per conversation
- [x] **Token Usage Counter** — per-message badge + running session total
- [x] **Markdown rendering** in AI answers (bonus A)
- [x] **Citations** — source snippets shown under grounded answers (bonus B)
- [x] **Streaming response** — simulated token-by-token render (bonus C)
- [x] **Conversation history** — create / switch / delete chats (bonus E)
- [ ] **Real auth (JWT)** — currently mocked, see `BACKEND.md`
- [ ] **Real RAG / embeddings** — currently mocked retrieval (bonus D)
- [ ] **Backend, DB, Vector DB** — not implemented (this is the frontend draft)

## Architecture

```
app/
  login/page.tsx        # mock login form
  page.tsx              # auth-aware redirect
  chat/
    layout.tsx          # protected route guard + StoreProvider
    page.tsx            # chat shell (sidebar + messages + composer)
    sidebar.tsx         # conversations, documents panel, token meter, user
    documents-panel.tsx # upload + attach/detach documents as context
    message-bubble.tsx  # markdown + citations + token badge
    composer.tsx        # auto-growing input, Enter to send
    token-meter.tsx     # running session token total
lib/
  types.ts              # shared types (source of truth for the API contract)
  auth-context.tsx      # MOCK auth — swap for JWT login
  store.tsx             # MOCK conversations/documents/chat state
  mock-data.ts          # all fake data + canned responses (delete once wired)
```

State is held in React context (`AuthProvider`, `StoreProvider`). The mock layer is
deliberately isolated so connecting the backend means editing only `auth-context.tsx`
and `store.tsx`.

## Known Issues / Not Done Yet

- No real backend: responses, token counts, and retrieval are all simulated.
- Mock session is stored in `sessionStorage`, not a real JWT.
- Uploaded files are not actually parsed/embedded — processing is faked with a timer.
- No persistence: refreshing resets to the seeded mock conversations.
- No tests yet.

## Next Step

Implement the FastAPI backend following [`BACKEND.md`](./BACKEND.md), then replace the
mock functions in `lib/auth-context.tsx` and `lib/store.tsx` with real `fetch` calls.
