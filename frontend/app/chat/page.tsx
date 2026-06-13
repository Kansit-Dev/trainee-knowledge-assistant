"use client"

import { useEffect, useRef } from "react"
import { Sparkles, FileText, MessageSquare, Coins } from "lucide-react"
import { useStore } from "@/lib/store"
import { Sidebar } from "./sidebar"
import { MessageBubble } from "./message-bubble"
import { Composer } from "./composer"

const SUGGESTIONS = [
  { icon: MessageSquare, text: "Summarize the key points of my uploaded document" },
  { icon: FileText, text: "What does the leave policy say about carryover?" },
  { icon: Coins, text: "Explain how token usage is calculated" },
]

function EmptyState() {
  const { sendMessage } = useStore()
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Sparkles className="size-7" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">How can I help you today?</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground text-balance">
        Ask a question, or upload a PDF/TXT from the sidebar and chat with its contents.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => void sendMessage(s.text)}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left text-xs hover:border-primary/50 hover:bg-accent"
          >
            <s.icon className="size-4 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { activeConversation } = useStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = activeConversation?.messages ?? []

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center border-b border-border px-4">
          <h1 className="truncate text-sm font-medium">
            {activeConversation?.title ?? "New chat"}
          </h1>
        </header>

        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          </div>
        )}

        <Composer />
      </div>
    </div>
  )
}
