export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/database'

// 🔍 调试API：检查用户数据
export async function GET(request: NextRequest) {
  try {
    // 🔐 验证用户身份
    const session = await getServerSession(authOptions)
    
    console.log('🔍 调试信息 - Session:', JSON.stringify(session, null, 2))
    
    if (!session?.user?.email) {
      return NextResponse.json({
        error: '用户未登录',
        session: session,
        hasUser: !!session?.user,
        hasEmail: !!session?.user?.email
      }, { status: 401 })
    }

    // 🔍 查找用户
    console.log('🔍 查找用户:', session.user.email)
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    console.log('🔍 数据库查询结果:', user)

    return NextResponse.json({
      success: true,
      session: {
        user: session.user,
        expires: session.expires
      },
      currentUser: user,
      debug: {
        searchEmail: session.user.email,
        userFound: !!user,
        userCredits: user?.credits || 0
      }
    })

  } catch (error) {
    console.error('🚨 调试API错误:', error)
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 