"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api, ApiError } from "./api"
import { useAuth } from "./auth-context"
import type { Conversation, Message, TokenUsage, UploadedDocument } from "./types"

// ── Local helpers ──────────────────────────────────────────────────────────────

function tempId(): string {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`
}

function makeMessage(
  role: Message["role"],
  content: string,
  extra: Partial<Message> = {},
): Message {
  return {
    id: tempId(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

// ── Store interface ────────────────────────────────────────────────────────────

interface StoreValue {
  conversations: Conversation[]
  documents: UploadedDocument[]
  activeId: string | null
  setActiveId: (id: string | null) => void
  activeConversation: Conversation | null
  sessionTokens: TokenUsage
  loading: boolean
  createConversation: () => Promise<string>
  deleteConversation: (id: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  attachDocument: (file: File) => Promise<void>
  removeDocument: (docId: string) => Promise<void>
  toggleDocumentOnConversation: (docId: string) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Bootstrap: load conversations + documents when user is authenticated ────
  useEffect(() => {
    if (!user) {
      setConversations([])
      setDocuments([])
      setActiveId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([api.listConversations(), api.listDocuments()])
      .then(([convs, docs]) => {
        setConversations(convs)
        setDocuments(docs)
        setActiveId(convs[0]?.id ?? null)
      })
      .catch(() => {
        // Network error: gracefully fall back to empty state
      })
      .finally(() => setLoading(false))
  }, [user?.id])   // re-run only when the logged-in user changes

  // ── Derived state ──────────────────────────────────────────────────────────

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  // Sum token usage from every assistant message across all conversations.
  const sessionTokens = useMemo<TokenUsage>(() => {
    let prompt = 0
    let completion = 0
    for (const conv of conversations) {
      for (const m of conv.messages) {
        if (m.usage) {
          prompt += m.usage.promptTokens
          completion += m.usage.completionTokens
        }
      }
    }
    return { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion }
  }, [conversations])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const patchConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
    },
    [],
  )

  // ── Actions ─────────────────────────────────────────────────────────────────

  const createConversation = useCallback(async (): Promise<string> => {
    const conv = await api.createConversation()
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.id)
    return conv.id
  }, [])

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await api.deleteConversation(id)
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      setActiveId((cur) => (cur === id ? (next[0]?.id ?? null) : cur))
      return next
    })
  }, [])

  const toggleDocumentOnConversation = useCallback(
    async (docId: string): Promise<void> => {
      if (!activeId) return
      const conv = conversations.find((c) => c.id === activeId)
      if (!conv) return
      const has = conv.documentIds.includes(docId)
      const newDocIds = has
        ? conv.documentIds.filter((d) => d !== docId)
        : [...conv.documentIds, docId]
      const updated = await api.updateConversation(activeId, { documentIds: newDocIds })
      patchConversation(activeId, () => updated)
    },
    [activeId, conversations, patchConversation],
  )

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (!trimmed) return

      // Ensure there is an active conversation.
      let convId = activeId
      let isFirstMessage = false

      if (!convId) {
        // No conversation yet — create one with the message text as title.
        const conv = await api.createConversation(trimmed.slice(0, 60))
        setConversations((prev) => [conv, ...prev])
        setActiveId(conv.id)
        convId = conv.id
        isFirstMessage = true
      } else {
        // Check before optimistic update so we see the original message count.
        const existing = conversations.find((c) => c.id === convId)
        isFirstMessage = (existing?.messages.length ?? 0) === 0
      }

      // Document ids attached to this conversation.
      const docIds = conversations.find((c) => c.id === convId)?.documentIds ?? []

      // ── Optimistic UI: show user message + pending assistant placeholder ──
      const userMsg = makeMessage("user", trimmed)
      const pendingMsg = makeMessage("assistant", "", { pending: true })

      patchConversation(convId, (c) => ({
        ...c,
        title: isFirstMessage ? trimmed.slice(0, 60) : c.title,
        updatedAt: new Date().toISOString(),
        messages: [...c.messages, userMsg, pendingMsg],
      }))

      // ── Call the real backend ──────────────────────────────────────────────
      try {
        const assistantMsg = await api.sendChatMessage(convId, trimmed, docIds)

        // Replace the pending placeholder with the real assistant message.
        patchConversation(convId, (c) => ({
          ...c,
          updatedAt: new Date().toISOString(),
          messages: c.messages.map((m) =>
            m.id === pendingMsg.id ? { ...assistantMsg, pending: false } : m,
          ),
        }))

        // Persist title to backend for first-message conversations.
        if (isFirstMessage) {
          api.updateConversation(convId, { title: trimmed.slice(0, 60) }).catch(() => {})
        }
      } catch (err) {
        // Show a clean error in the chat instead of crashing.
        const detail = err instanceof ApiError ? err.detail : "Something went wrong"
        patchConversation(convId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === pendingMsg.id
              ? { ...m, content: `⚠ ${detail}`, pending: false }
              : m,
          ),
        }))
      }
    },
    [activeId, conversations, patchConversation],
  )

  const attachDocument = useCallback(
    async (file: File): Promise<void> => {
      const doc = await api.uploadDocument(file)
      setDocuments((prev) => [doc, ...prev])

      // Auto-attach to the active conversation as RAG context.
      if (activeId) {
        const conv = conversations.find((c) => c.id === activeId)
        if (conv && !conv.documentIds.includes(doc.id)) {
          const updated = await api.updateConversation(activeId, {
            documentIds: [...conv.documentIds, doc.id],
          })
          patchConversation(activeId, () => updated)
        }
      }
    },
    [activeId, conversations, patchConversation],
  )

  const removeDocument = useCallback(async (docId: string): Promise<void> => {
    await api.deleteDocument(docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
    // Also scrub the id from any conversation that references it.
    setConversations((prev) =>
      prev.map((c) => ({ ...c, documentIds: c.documentIds.filter((d) => d !== docId) })),
    )
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────

  const value: StoreValue = {
    conversations,
    documents,
    activeId,
    setActiveId,
    activeConversation,
    sessionTokens,
    loading,
    createConversation,
    deleteConversation,
    sendMessage,
    attachDocument,
    removeDocument,
    toggleDocumentOnConversation,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within a StoreProvider")
  return ctx
}
