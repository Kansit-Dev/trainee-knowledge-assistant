"use client"

import { Coins } from "lucide-react"
import { useStore } from "@/lib/store"

export function TokenMeter() {
  const { sessionTokens } = useStore()
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="size-3.5" aria-hidden="true" />
          Session tokens
        </span>
        <span className="font-mono font-medium tabular-nums">
          {sessionTokens.totalTokens.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>in {sessionTokens.promptTokens.toLocaleString()}</span>
        <span>out {sessionTokens.completionTokens.toLocaleString()}</span>
      </div>
    </div>
  )
}
