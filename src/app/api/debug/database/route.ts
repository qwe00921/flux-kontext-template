export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔍 调试API：测试数据库连接
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始测试数据库连接...')
    
    // 测试Supabase管理员客户端连接
    const supabase = createAdminClient()
    
    // 测试基本连接 - 查询users表结构
    const { data: tableInfo, error: tableError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (tableError) {
      console.error('🚨 数据库连接失败:', tableError)
      return NextResponse.json({
        success: false,
        error: '数据库连接失败',
        details: tableError.message,
        code: tableError.code,
        hint: tableError.hint
      }, { status: 500 })
    }
    
    // 测试用户表查询
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, credits, created_at')
      .limit(5)
    
    console.log('✅ 数据库连接成功，用户数据:', users)
    
    return NextResponse.json({
      success: true,
      message: '数据库连接正常',
      connection: {
        status: 'connected',
        tableAccessible: !tableError,
        userCount: users?.length || 0,
        sampleUsers: users || []
      },
      environment: {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
        SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET'
      }
    })

  } catch (error) {
    console.error('🚨 数据库测试错误:', error)
    return NextResponse.json({
      success: false,
      error: '数据库测试失败',
      details: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 