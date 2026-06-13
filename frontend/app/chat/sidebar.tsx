"use client"

import { useState } from "react"
import {
  MessageSquarePlus,
  MessageSquare,
  Trash2,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DocumentsPanel } from "./documents-panel"
import { TokenMeter } from "./token-meter"

export function Sidebar() {
  const { user, logout } = useAuth()
  const {
    conversations,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
  } = useStore()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 border-r border-border bg-sidebar p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <PanelLeft className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={createConversation}
          aria-label="New chat"
        >
          <MessageSquarePlus className="size-5" />
        </Button>
      </div>
    )
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold">Knowledge Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="size-5" />
        </Button>
      </div>

      <div className="px-3">
        <Button onClick={createConversation} className="w-full justify-start gap-2">
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          New chat
        </Button>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Chats</p>
        <ul className="flex flex-col gap-0.5">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <div
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
                  conv.id === activeId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(conv.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare className="size-4 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="truncate">{conv.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteConversation(conv.id)}
                  aria-label={`Delete ${conv.title}`}
                  className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {conversations.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              No chats yet.
            </li>
          )}
        </ul>
      </nav>

      <DocumentsPanel />
      <TokenMeter />

      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            {user?.displayName.slice(0, 1).toUpperCase()}
          </div>
          <span className="truncate text-sm">{user?.displayName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </aside>
  )
}
