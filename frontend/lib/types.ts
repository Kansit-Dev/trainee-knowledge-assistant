// Shared types for the Knowledge Assistant frontend.
// These mirror the shapes the FastAPI backend is expected to return.
// See BACKEND.md for the contract each endpoint must fulfill.

export interface User {
  id: string
  username: string
  displayName: string
}

export interface Citation {
  id: string
  documentId: string
  documentName: string
  snippet: string
  page?: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  // Present on assistant messages once a response is complete.
  usage?: TokenUsage
  citations?: Citation[]
  pending?: boolean
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Message[]
  // Document ids attached as context for this conversation.
  documentIds: string[]
}

export interface UploadedDocument {
  id: string
  name: string
  sizeBytes: number
  type: "pdf" | "txt"
  status: "processing" | "ready" | "error"
  chunkCount: number
  uploadedAt: string
}
