"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { StoreProvider } from "@/lib/store"

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, ready } = useAuth()

  // Protected route: bounce unauthenticated users to /login.
  useEffect(() => {
    if (ready && !user) router.replace("/login")
  }, [ready, user, router])

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return <StoreProvider>{children}</StoreProvider>
}
