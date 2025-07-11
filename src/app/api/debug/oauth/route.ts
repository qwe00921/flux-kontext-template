export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 🔍 调试API：检查OAuth配置和登录状态
export async function GET(request: NextRequest) {
  try {
    // 检查会话
    const session = await getServerSession(authOptions)
    
    // 检查OAuth配置
    const oauthConfig = {
      // Google OAuth配置检查 (使用正确的变量名)
      googleClientId: process.env.GOOGLE_ID ? 
        `${process.env.GOOGLE_ID.substring(0, 10)}...` : 'NOT_SET',
      googleClientSecret: process.env.GOOGLE_SECRET ? 'SET' : 'NOT_SET',
      
      // NextAuth配置检查
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT_SET',
      
      // 当前会话信息
      hasSession: !!session,
      sessionUser: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image
      } : null,
      
      // 环境信息
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }

    return NextResponse.json({
      success: true,
      oauth: oauthConfig,
      message: 'OAuth配置检查完成',
      recommendations: [
        !process.env.GOOGLE_ID && '❌ 需要设置 GOOGLE_ID',
        !process.env.GOOGLE_SECRET && '❌ 需要设置 GOOGLE_SECRET',
        process.env.NEXTAUTH_URL?.startsWith('http://') && '⚠️ NEXTAUTH_URL 应该使用 https://',
        !session && '⚠️ 当前没有有效会话'
      ].filter(Boolean)
    })

  } catch (error) {
    console.error('🚨 OAuth配置检查错误:', error)
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 