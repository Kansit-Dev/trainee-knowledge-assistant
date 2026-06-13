/**
 * lib/api.ts — Typed fetch wrapper for the Knowledge Assistant backend.
 *
 * - Base URL: process.env.NEXT_PUBLIC_API_URL (set in .env / docker-compose)
 * - Auth: attaches `Authorization: Bearer <token>` from localStorage (key: "ka.token")
 * - All public types come from lib/types.ts — no other file is modified.
 *
 * Usage:
 *   import { api } from "@/lib/api"
 *   const { user } = await api.login("admin", "admin123")
 */

import type {
  Conversation,
  Message,
  TokenUsage,
  UploadedDocument,
  User,
} from "./types"

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")

/** localStorage key where the JWT is stored. */
export const TOKEN_KEY = "ka.token"

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
}

// ─── API error ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail)
    this.name = "ApiError"
  }
}

// ─── Raw backend shapes (snake_case fields the server actually sends) ─────────
// These are kept private — callers only ever see the camelCase types from types.ts.

interface RawUserOut {
  id: string
  username: string
  display_name: string | null
}

interface RawLoginResponse {
  access_token: string
  user: RawUserOut
}

interface RawMeResponse {
  user: RawUserOut
}

interface RawDocument {
  id: string
  name: string
  type: "pdf" | "txt"
  size_bytes: number
  status: "processing" | "ready" | "error"
  chunk_count: number
  uploaded_at: string
}

// Conversations, messages, chat and usage schemas already use camelCase on the
// backend (ConversationOut, MessageOut, etc.) so no mapping is needed there.

interface RawMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  usage?: TokenUsage
  citations?: Message["citations"]
}

interface RawConversation {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  documentIds: string[]
  messages: RawMessage[]
}

interface RawChatResponse {
  message: RawMessage
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeUser(raw: RawUserOut): User {
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.display_name ?? raw.username,
  }
}

function normalizeDocument(raw: RawDocument): UploadedDocument {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    sizeBytes: raw.size_bytes,
    status: raw.status,
    chunkCount: raw.chunk_count,
    uploadedAt: raw.uploaded_at,
  }
}

function normalizeMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content,
    createdAt: raw.createdAt,
    usage: raw.usage,
    citations: raw.citations,
  }
}

function normalizeConversation(raw: RawConversation): Conversation {
  return {
    id: raw.id,
    title: raw.title ?? "New chat",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    documentIds: raw.documentIds ?? [],
    messages: (raw.messages ?? []).map(normalizeMessage),
  }
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: RequestInit["body"] | Record<string, unknown>
  /** If true, do not set Content-Type (let the browser set multipart boundary). */
  multipart?: boolean
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, multipart, ...rest } = options

  const headers: Record<string, string> = {}

  // Attach JWT when available
  const token = getToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  // Set Content-Type only for JSON bodies
  let serializedBody: RequestInit["body"] | undefined
  if (body !== undefined) {
    if (multipart) {
      // FormData — let the browser set the multipart/form-data boundary
      serializedBody = body as FormData
    } else if (typeof body === "object" && body !== null && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json"
      serializedBody = JSON.stringify(body)
    } else {
      serializedBody = body as RequestInit["body"]
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: { ...headers, ...((rest.headers as Record<string, string>) ?? {}) },
    body: serializedBody,
  })

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json().catch(() => ({ detail: response.statusText }))

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : JSON.stringify(data?.detail ?? data)
    throw new ApiError(response.status, detail)
  }

  return data as T
}

// ─── Public API surface ───────────────────────────────────────────────────────

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────

  /**
   * POST /auth/login
   * Returns the normalized User and stores the JWT automatically.
   */
  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; user: User }> {
    const raw = await request<RawLoginResponse>("/auth/login", {
      method: "POST",
      body: { username, password },
    })
    setToken(raw.access_token)
    return { accessToken: raw.access_token, user: normalizeUser(raw.user) }
  },

  /**
   * GET /auth/me
   * Validates the stored JWT and returns the current user.
   */
  async getMe(): Promise<User> {
    const raw = await request<RawMeResponse>("/auth/me")
    return normalizeUser(raw.user)
  },

  // ── Conversations ──────────────────────────────────────────────────────────

  /**
   * GET /conversations
   * Returns all conversations for the authenticated user.
   */
  async listConversations(): Promise<Conversation[]> {
    const raw = await request<RawConversation[]>("/conversations")
    return raw.map(normalizeConversation)
  },

  /**
   * POST /conversations
   * Creates a new conversation with an optional title.
   */
  async createConversation(title?: string): Promise<Conversation> {
    const raw = await request<RawConversation>("/conversations", {
      method: "POST",
      body: { title: title ?? null },
    })
    return normalizeConversation(raw)
  },

  /**
   * GET /conversations/{id}
   * Fetches a single conversation including its messages.
   */
  async getConversation(id: string): Promise<Conversation> {
    const raw = await request<RawConversation>(`/conversations/${id}`)
    return normalizeConversation(raw)
  },

  /**
   * PATCH /conversations/{id}
   * Updates the title and/or attached document ids.
   */
  async updateConversation(
    id: string,
    patch: { title?: string; documentIds?: string[] },
  ): Promise<Conversation> {
    const raw = await request<RawConversation>(`/conversations/${id}`, {
      method: "PATCH",
      body: patch,
    })
    return normalizeConversation(raw)
  },

  /**
   * DELETE /conversations/{id}
   * Permanently deletes the conversation. Returns undefined (204).
   */
  async deleteConversation(id: string): Promise<void> {
    await request<void>(`/conversations/${id}`, { method: "DELETE" })
  },

  // ── Documents ──────────────────────────────────────────────────────────────

  /**
   * GET /documents
   * Returns all documents uploaded by the authenticated user.
   */
  async listDocuments(): Promise<UploadedDocument[]> {
    const raw = await request<RawDocument[]>("/documents")
    return raw.map(normalizeDocument)
  },

  /**
   * POST /documents  (multipart/form-data)
   * Uploads a file and returns the created document record.
   */
  async uploadDocument(file: File): Promise<UploadedDocument> {
    const form = new FormData()
    form.append("file", file)
    const raw = await request<RawDocument>("/documents", {
      method: "POST",
      body: form,
      multipart: true,
    })
    return normalizeDocument(raw)
  },

  /**
   * DELETE /documents/{id}
   * Permanently deletes the document. Returns undefined (204).
   */
  async deleteDocument(id: string): Promise<void> {
    await request<void>(`/documents/${id}`, { method: "DELETE" })
  },

  // ── Chat ───────────────────────────────────────────────────────────────────

  /**
   * POST /chat
   * Sends a user message and returns the assistant reply with usage + citations.
   */
  async sendChatMessage(
    conversationId: string,
    message: string,
    documentIds: string[] = [],
  ): Promise<Message> {
    const raw = await request<RawChatResponse>("/chat", {
      method: "POST",
      body: {
        conversation_id: conversationId,
        message,
        document_ids: documentIds,
      },
    })
    return normalizeMessage(raw.message)
  },

  // ── Usage ──────────────────────────────────────────────────────────────────

  /**
   * GET /usage/session
   * Returns server-authoritative cumulative token usage for the current user.
   */
  async getSessionUsage(): Promise<TokenUsage> {
    return request<TokenUsage>("/usage/session")
  },
}
