export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // 验证输入
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码是必需的' },
        { status: 400 }
      )
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '用户已存在' },
        { status: 400 }
      )
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    })

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user as any

    return NextResponse.json({
      message: '用户注册成功',
      user: userWithoutPassword
    })

  } catch (error: unknown) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Registration failed' 
      },
      { status: 500 }
    )
  }
}

// 支持的HTTP方法
export async function GET() {
  return NextResponse.json({
    message: '用户注册API - 使用POST方法注册新用户',
    requiredFields: ['email', 'password'],
    optionalFields: ['name']
  })
} 