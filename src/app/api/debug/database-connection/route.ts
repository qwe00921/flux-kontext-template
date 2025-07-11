export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔍 数据库连接测试API
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始数据库连接测试...')
    
    // 1. 检查环境变量
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
    }
    
    console.log('🔍 环境变量检查:', envCheck)
    
    // 2. 创建Supabase客户端
    const supabase = createAdminClient()
    console.log('✅ Supabase客户端创建成功')
    
    // 3. 测试简单查询
    const { data: testQuery, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    console.log('🔍 测试查询结果:', {
      hasData: !!testQuery,
      error: testError?.message || null,
      errorCode: testError?.code || null
    })
    
    // 4. 测试特定用户查询（如果有session的话）
    let userTestResult = null
    try {
      const { data: userCount, error: userError } = await supabase
        .from('users')
        .select('id, email, credits', { count: 'exact' })
        .limit(5)
      
      userTestResult = {
        success: !userError,
        userCount: userCount?.length || 0,
        error: userError?.message || null,
        sampleUsers: userCount?.map(u => ({ id: u.id, email: u.email, credits: u.credits })) || []
      }
    } catch (error) {
      userTestResult = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      databaseConnection: {
        clientCreated: true,
        testQuerySuccess: !testError,
        testQueryError: testError?.message || null
      },
      userTableTest: userTestResult
    })
    
  } catch (error) {
    console.error('🚨 数据库连接测试失败:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database connection test failed',
      details: error instanceof Error ? error.message : '未知错误',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : '') : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 