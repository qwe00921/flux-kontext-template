"use client"

import { useState, useEffect, useRef } from 'react'
// import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Coins, RefreshCw, ShoppingCart, Loader2 } from 'lucide-react'
import Link from 'next/link'

// 已移除 useSession 相关逻辑，直接用 mock 数据
interface CreditDisplayProps {
  className?: string;
}

export function CreditDisplay({ className }: CreditDisplayProps) {
  // mock session
  const session = { user: { email: 'demo@mock.com', credits: 100 } }
  
  return (
    <div className={`flex items-center gap-2 text-sm ${className || ''}`}>
      <span className="text-gray-600">Credits: {session.user.credits}</span>
    </div>
  )
} 