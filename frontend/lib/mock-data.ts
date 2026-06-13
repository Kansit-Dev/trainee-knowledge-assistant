import type {
  Citation,
  Conversation,
  Message,
  TokenUsage,
  UploadedDocument,
} from "./types"

// -----------------------------------------------------------------------------
// MOCK DATA LAYER
// -----------------------------------------------------------------------------
// Everything in this file is fake / in-memory. It exists so the UI can be built
// and demoed without a backend. When the FastAPI backend is ready, replace the
// functions in lib/api.ts with real fetch() calls and delete this file.
// -----------------------------------------------------------------------------

export const MOCK_CREDENTIALS = {
  username: "admin",
  password: "admin123",
}

function id() {
  return Math.random().toString(36).slice(2, 10)
}

// Rough token estimate: ~4 chars per token. The real count comes from the
// model provider response on the backend.
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

export function makeUsage(prompt: string, completion: string): TokenUsage {
  const promptTokens = estimateTokens(prompt)
  const completionTokens = estimateTokens(completion)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

export const MOCK_DOCUMENTS: UploadedDocument[] = [
  {
    id: "doc-onboarding",
    name: "employee-onboarding.pdf",
    sizeBytes: 248_000,
    type: "pdf",
    status: "ready",
    chunkCount: 42,
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "doc-policy",
    name: "leave-policy.txt",
    sizeBytes: 12_400,
    type: "txt",
    status: "ready",
    chunkCount: 8,
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
]

const sampleCitations: Citation[] = [
  {
    id: id(),
    documentId: "doc-policy",
    documentName: "leave-policy.txt",
    snippet:
      "Full-time employees accrue 1.25 days of paid leave per month, totalling 15 days per year.",
    page: 1,
  },
  {
    id: id(),
    documentId: "doc-onboarding",
    documentName: "employee-onboarding.pdf",
    snippet:
      "New hires must complete the security training within the first two weeks of joining.",
    page: 4,
  },
]

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    title: "Leave policy questions",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    documentIds: ["doc-policy"],
    messages: [
      {
        id: id(),
        role: "user",
        content: "How many paid leave days do full-time employees get per year?",
        createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      },
      {
        id: id(),
        role: "assistant",
        content:
          "Full-time employees accrue **1.25 days** of paid leave each month, which adds up to **15 days per year**. Unused leave can be carried over up to a maximum of 5 days into the next year.",
        createdAt: new Date(Date.now() - 1000 * 60 * 39).toISOString(),
        usage: { promptTokens: 86, completionTokens: 44, totalTokens: 130 },
        citations: [sampleCitations[0]],
      },
    ],
  },
  {
    id: "conv-2",
    title: "General chat",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    documentIds: [],
    messages: [
      {
        id: id(),
        role: "user",
        content: "Give me three tips for writing clean commit messages.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25.5).toISOString(),
      },
      {
        id: id(),
        role: "assistant",
        content:
          "Here are three quick tips:\n\n1. **Use the imperative mood** — write \"Add login page\" not \"Added login page\".\n2. **Keep the summary under ~50 characters** and put details in the body.\n3. **Explain the why, not just the what** — future you will thank you.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
        usage: { promptTokens: 24, completionTokens: 68, totalTokens: 92 },
      },
    ],
  },
]

// A canned assistant reply generator so the chat feels alive without a model.
export function mockAssistantReply(
  userText: string,
  hasContext: boolean,
): { content: string; citations?: Citation[] } {
  if (hasContext) {
    return {
      content: `Based on the uploaded document, here's what I found regarding "${userText.trim()}":\n\nThe relevant section indicates the policy applies to all full-time staff. (This is a mock answer — wire up the backend to get real document-grounded responses.)`,
      citations: [sampleCitations[Math.floor(Math.random() * sampleCitations.length)]],
    }
  }
  return {
    content: `You asked: "${userText.trim()}".\n\nThis is a **mock response** generated entirely on the client. Once the FastAPI backend is connected, this message will be replaced by a real model completion with accurate token usage.`,
  }
}

export function newConversation(): Conversation {
  const now = new Date().toISOString()
  return {
    id: `conv-${id()}`,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    documentIds: [],
    messages: [],
  }
}

export function newMessage(
  role: Message["role"],
  content: string,
  extra: Partial<Message> = {},
): Message {
  return {
    id: id(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

export function newDocument(file: { name: string; size: number }): UploadedDocument {
  const type = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt"
  return {
    id: `doc-${id()}`,
    name: file.name,
    sizeBytes: file.size,
    type,
    status: "processing",
    chunkCount: 0,
    uploadedAt: new Date().toISOString(),
  }
}
