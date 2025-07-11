export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'

// 🔍 调试API：检查环境变量配置
export async function GET(request: NextRequest) {
  try {
    const envCheck = {
      // NextAuth配置
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT_SET',
      
      // Google OAuth配置 (使用正确的变量名)
      GOOGLE_ID: process.env.GOOGLE_ID ? 'SET' : 'NOT_SET',
      GOOGLE_SECRET: process.env.GOOGLE_SECRET ? 'SET' : 'NOT_SET',
      
      // Supabase配置
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
      
      // 系统环境
      NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
      VERCEL: process.env.VERCEL || 'NO',
      VERCEL_URL: process.env.VERCEL_URL || 'NOT_SET',
      
      // 检查NEXTAUTH_URL是否正确配置为HTTPS
      NEXTAUTH_URL_ISSUE: process.env.NEXTAUTH_URL?.startsWith('http://') ? 'SHOULD_BE_HTTPS' : 'OK',
      
      // 请求信息
      requestUrl: request.url,
      requestHeaders: {
        host: request.headers.get('host'),
        'user-agent': request.headers.get('user-agent'),
        cookie: request.headers.get('cookie') ? 'HAS_COOKIES' : 'NO_COOKIES'
      }
    }

    return NextResponse.json({
      success: true,
      environment: envCheck,
      message: '环境变量检查完成'
    })

  } catch (error) {
    console.error('🚨 环境变量检查错误:', error)
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 