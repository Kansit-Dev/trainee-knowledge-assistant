"use client"

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowUp } from "lucide-react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"

export function Composer() {
  const { sendMessage, activeConversation } = useStore()
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function autosize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  async function submit() {
    const text = value.trim()
    if (!text || sending) return
    setValue("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setSending(true)
    try {
      await sendMessage(text)
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const contextCount = activeConversation?.documentIds.length ?? 0

  return (
    <div className="border-t border-border bg-background px-4 py-4">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              autosize()
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              contextCount > 0
                ? `Ask about your ${contextCount} attached document${contextCount > 1 ? "s" : ""}…`
                : "Message Knowledge Assistant…"
            }
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!value.trim() || sending}
            className="size-9 shrink-0 rounded-xl"
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {contextCount > 0
            ? `${contextCount} document${contextCount > 1 ? "s" : ""} in context`
            : "Ask anything — or upload a document to chat with it"}
        </p>
      </form>
    </div>
  )
}
