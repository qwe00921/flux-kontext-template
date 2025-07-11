export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// 🔍 调试API：检查用户数据
export async function GET(request: NextRequest) {
  try {
    // 直接返回 mock 用户数据
    return NextResponse.json({
      success: true,
      session: {
        user: { email: 'demo@mock.com', id: 'mock' },
        expires: new Date(Date.now() + 3600 * 1000).toISOString()
      },
      currentUser: { email: 'demo@mock.com', id: 'mock', credits: 100 },
      debug: {
        searchEmail: 'demo@mock.com',
        userFound: true,
        userCredits: 100
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 