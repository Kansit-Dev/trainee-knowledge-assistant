"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Sparkles, User as UserIcon, FileText } from "lucide-react"
import type { Message } from "@/lib/types"
import { cn } from "@/lib/utils"

function CitationList({ message }: { message: Message }) {
  if (!message.citations || message.citations.length === 0) return null
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Sources</p>
      <ul className="flex flex-col gap-1.5">
        {message.citations.map((c, i) => (
          <li
            key={c.id}
            className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] font-medium text-primary">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-medium">
                <FileText className="size-3" aria-hidden="true" />
                {c.documentName}
                {c.page ? <span className="text-muted-foreground">· p.{c.page}</span> : null}
              </span>
              <span className="mt-0.5 block text-muted-foreground">{c.snippet}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TokenBadge({ message }: { message: Message }) {
  if (!message.usage) return null
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {message.usage.totalTokens} tokens · {message.usage.promptTokens} in /{" "}
      {message.usage.completionTokens} out
    </span>
  )
}

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex gap-3 px-4 py-5", isUser ? "bg-transparent" : "bg-card/40")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <UserIcon className="size-4" /> : <Sparkles className="size-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {isUser ? "You" : "Assistant"}
        </p>

        {message.pending && message.content === "" ? (
          <div className="flex gap-1 py-1.5" aria-label="Assistant is typing">
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose-chat text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {!message.pending && (
          <>
            <CitationList message={message} />
            <TokenBadge message={message} />
          </>
        )}
      </div>
    </div>
  )
})
