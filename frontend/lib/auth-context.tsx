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
import { api, clearToken, ApiError } from "./api"
import type { User } from "./types"

interface AuthContextValue {
  user: User | null
  ready: boolean
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  // On mount: validate any stored JWT via GET /auth/me.
  // If the token is missing, expired, or invalid the call will throw and we
  // start unauthenticated (token is cleared so it doesn't linger).
  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      // api.login() calls POST /auth/login and stores the JWT in localStorage.
      const result = await api.login(username, password)
      setUser(result.user)
      return { ok: true }
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.detail : "Login failed. Please try again."
      return { ok: false, error: detail }
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    clearToken()
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
