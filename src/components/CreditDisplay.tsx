"use client"

import { useState, useEffect, useRef } from 'react'
// import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Coins, RefreshCw, ShoppingCart, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface CreditDisplayProps {
  onCreditsUpdate?: (credits: number) => void
  showBuyButton?: boolean
  className?: string
}

export function CreditDisplay({ 
  onCreditsUpdate, 
  showBuyButton = true, 
  className = "" 
}: CreditDisplayProps) {
  const { data: session, status } = useSession()
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 🔧 防止无限循环的重试控制
  const retryCountRef = useRef(0)
  const maxRetries = 2
  const lastFetchTimeRef = useRef(0)
  const minFetchInterval = 5000 // 最小5秒间隔

  // 🔄 页面加载时获取积分
  useEffect(() => {
    const fetchCredits = async () => {
      if (!session?.user?.email) {
        console.log('🔍 User not logged in or missing email information:', { session, hasUser: !!session?.user, hasEmail: !!session?.user?.email })
        return
      }

      // 🔧 防止频繁请求
      const now = Date.now()
      if (now - lastFetchTimeRef.current < minFetchInterval) {
        console.log('🔧 Request too frequent, skipping this request')
        return
      }
      lastFetchTimeRef.current = now

      setLoading(true)
      setError(null)

      try {
        // 🔧 只在开发环境输出日志，减少控制台刷屏
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Starting to get user credits:', session.user.email)
        }
        
        const response = await fetch('/api/user/credits')
        const data = await response.json()

        if (response.ok && data.success) {
          const userCredits = data.user.credits
          setCredits(userCredits)
          onCreditsUpdate?.(userCredits)
          // 🔧 只在开发环境输出日志
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Credits retrieval successful:', userCredits)
          }
          retryCountRef.current = 0 // 重置重试计数
        } else if (response.status === 404 && data.error === 'User information does not exist') {
          // 🔧 用户已登录但数据库中不存在，尝试自动创建（限制重试次数）
          if (retryCountRef.current < maxRetries) {
            console.log(`🔧 User logged in but not found in database, auto-creating... (retry ${retryCountRef.current + 1}/${maxRetries})`)
            retryCountRef.current++
            
            try {
              const ensureResponse = await fetch('/api/user/ensure', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              })
              
              const ensureData = await ensureResponse.json()
              
              if (ensureResponse.ok && ensureData.success) {
                console.log('🎉 User created successfully, credits:', ensureData.user.credits)
                const userCredits = ensureData.user.credits
                setCredits(userCredits)
                onCreditsUpdate?.(userCredits)
                retryCountRef.current = 0 // 重置重试计数
              } else {
                console.error('❌ User creation failed:', ensureData)
                setError(`User creation failed: ${ensureData.error || 'Unknown error'}`)
              }
            } catch (ensureError) {
              console.error('❌ User creation error:', ensureError)
              setError('Auto user creation failed, please refresh and try again')
            }
          } else {
            console.error('❌ Maximum retry attempts reached, stopping auto user creation')
            setError('User creation failed, please contact support or try again later')
          }
        } else if (response.status === 401) {
          // 🔐 认证失败，可能是session过期
          console.log('🔐 Authentication failed, may need to sign in again')
          setError('Login session expired, please sign in again')
        } else {
          console.error('❌ Failed to get credits:', data)
          setError(data.error || 'Failed to get credit information')
        }
      } catch (err) {
        console.error('❌ Network error:', err)
        setError('Network error, please try again later')
      } finally {
        setLoading(false)
      }
    }

    // 只有在用户已认证时才尝试获取积分
    if (status === 'authenticated') {
      fetchCredits()
    } else if (status === 'unauthenticated') {
      console.log('🔍 User not authenticated, skipping credit retrieval')
      setCredits(null)
      setError(null)
      retryCountRef.current = 0 // 重置重试计数
    }
    // status === 'loading' 时不做任何操作，等待认证完成
  }, [session, status, onCreditsUpdate])

  // 🔄 手动刷新积分
  const handleRefresh = async () => {
    if (!session?.user?.email) return

    // 🔧 重置重试计数，允许手动刷新
    retryCountRef.current = 0
    lastFetchTimeRef.current = 0

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user/credits')
      const data = await response.json()

      if (response.ok && data.success) {
        const userCredits = data.user.credits
        setCredits(userCredits)
        onCreditsUpdate?.(userCredits)
      } else {
        setError(data.error || 'Failed to get credit information')
      }
    } catch (err) {
      setError('Network error, please try again later')
      console.error('Failed to get credits:', err)
    } finally {
      setLoading(false)
    }
  }

  // 未登录状态
  if (status === 'unauthenticated') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="text-muted-foreground">
          <Coins className="w-3 h-3 mr-1" />
          <div className="text-center">
            <div className="text-muted-foreground mb-2">
              Please sign in
            </div>
          </div>
        </Badge>
      </div>
    )
  }

  // 加载中状态
  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="text-muted-foreground">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Loading...
        </Badge>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="destructive" className="text-red-600">
          <Coins className="w-3 h-3 mr-1" />
          {error}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-6 w-6 p-0"
          title="Refresh credits"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  // 正常显示积分
  const creditCount = credits ?? 0
  const isLowCredits = creditCount < 5 // 积分不足5个时显示警告

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 积分显示 */}
      <Badge 
        variant={isLowCredits ? "destructive" : "secondary"}
        className={`${
          isLowCredits 
            ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300" 
            : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300"
        }`}
      >
        <Coins className="w-3 h-3 mr-1" />
        {creditCount} Credits
      </Badge>

      {/* 刷新按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        className="h-6 w-6 p-0 hover:bg-muted"
        title="Refresh credits"
      >
        <RefreshCw className="w-3 h-3" />
      </Button>

      {/* 购买积分按钮 */}
      {showBuyButton && (
        <Link href="/pricing?tab=credits#credits">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
          >
            <ShoppingCart className="w-3 h-3 mr-1" />
            Buy Credits
          </Button>
        </Link>
      )}
    </div>
  )
} 