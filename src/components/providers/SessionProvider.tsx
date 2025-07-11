"use client"

interface SessionProviderProps {
  children: React.ReactNode
}

export default function SessionProvider({ children }: SessionProviderProps) {
  // 暂时移除 next-auth，直接返回子组件
  return <>{children}</>
} 