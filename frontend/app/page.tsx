"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export default function Home() {
  const router = useRouter()
  const { user, ready } = useAuth()

  useEffect(() => {
    if (!ready) return
    router.replace(user ? "/chat" : "/login")
  }, [ready, user, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </main>
  )
}
