export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

// 🔧 确保用户存在API - 如果用户不存在则自动创建
export async function POST(request: NextRequest) {
  try {
    // 🔐 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.log('❌ 用户未登录')
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      )
    }

    console.log('🔍 确保用户存在:', session.user.email)

    const supabase = createAdminClient()
    
    // 首先尝试查找用户
    try {
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .limit(1)
        .single()

      if (!findError && existingUser) {
        console.log('✅ 用户已存在:', existingUser.email)
        return NextResponse.json({
          success: true,
          message: '用户已存在',
          user: {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            credits: existingUser.credits || 0
          },
          action: 'found'
        })
      }

      // 如果用户不存在，尝试创建
      if (findError?.message?.includes('does not exist')) {
        console.log('❌ 用户表不存在，无法创建用户')
        return NextResponse.json({
          success: false,
          error: '数据库表不存在',
          message: '请先执行数据库初始化脚本',
          recommendation: '在Supabase SQL编辑器中执行 scripts/setup-database.sql'
        }, { status: 500 })
      }

      // 用户不存在，创建新用户
      console.log('🔧 创建新用户:', session.user.email)
      
      const newUserData = {
        email: session.user.email,
        name: session.user.name || null,
        image: session.user.image || null,
        credits: 100, // 默认积分
        signin_provider: 'nextauth',
        signin_type: 'oauth',
        signin_count: 1,
        last_signin_at: new Date().toISOString()
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single()

      if (createError) {
        console.error('🚨 创建用户失败:', createError)
        return NextResponse.json({
          success: false,
          error: '创建用户失败',
          details: createError.message
        }, { status: 500 })
      }

      console.log('✅ 用户创建成功:', newUser.email)
      
      return NextResponse.json({
        success: true,
        message: '用户创建成功',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          credits: newUser.credits || 0
        },
        action: 'created'
      })

    } catch (error) {
      console.error('🚨 数据库操作失败:', error)
      
      // 如果是表不存在的错误，提供明确的指导
      if (error instanceof Error && error.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: '数据库表不存在',
          message: '数据库尚未初始化',
          recommendation: '请在Supabase SQL编辑器中执行 scripts/setup-database.sql',
          debugInfo: {
            error: error.message,
            userEmail: session.user.email
          }
        }, { status: 500 })
      }

      return NextResponse.json({
        success: false,
        error: '数据库操作失败',
        details: error instanceof Error ? error.message : '未知错误'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ 确保用户存在失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 🔍 检查用户状态
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()
    
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .limit(1)
        .single()

      if (error) {
        if (error.message.includes('does not exist')) {
          return NextResponse.json({
            success: false,
            exists: false,
            error: '数据库表不存在',
            recommendation: '请执行数据库初始化'
          })
        }
        
        return NextResponse.json({
          success: false,
          exists: false,
          error: '用户不存在',
          canCreate: true
        })
      }

      return NextResponse.json({
        success: true,
        exists: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          credits: user.credits || 0
        }
      })

    } catch (error) {
      return NextResponse.json({
        success: false,
        error: '数据库查询失败',
        details: error instanceof Error ? error.message : '未知错误'
      }, { status: 500 })
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '服务器错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 