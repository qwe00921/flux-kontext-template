export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
// 已移除 getServerSession 和 authOptions 相关代码，直接跳过登录校验

// 🔍 调试API：检查OAuth配置和登录状态
export async function GET(request: NextRequest) {
  try {
    // 直接返回 mock OAuth 配置
    const oauthConfig = {
      googleClientId: process.env.GOOGLE_ID ? `${process.env.GOOGLE_ID.substring(0, 10)}...` : 'NOT_SET',
      googleClientSecret: process.env.GOOGLE_SECRET ? 'SET' : 'NOT_SET',
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT_SET',
      hasSession: true,
      sessionUser: { id: 'mock', email: 'demo@mock.com', name: 'Demo User', image: null },
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }
    return NextResponse.json({
      success: true,
      oauth: oauthConfig,
      message: 'OAuth配置检查完成 (mock)',
      recommendations: []
    })
  } catch (error) {
    console.error('🚨 OAuth配置检查错误:', error)
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 