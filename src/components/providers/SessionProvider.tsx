"use client"

interface SessionProviderProps {
  children: React.ReactNode
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
} 