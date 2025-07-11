export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔧 数据库检查和修复API
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始数据库检查...')
    
    const supabase = createAdminClient()
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: [],
      errors: [],
      fixes: []
    }

    // 检查必要的表是否存在
    const requiredTables = [
      'users',
      'payment_orders', 
      'credit_transactions',
      'subscriptions',
      'payment_configs',
      'generations'
    ]

    for (const tableName of requiredTables) {
      try {
        console.log(`🔍 检查表: ${tableName}`)
        
        // 尝试查询表结构
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)

        if (error) {
          console.log(`❌ 表 ${tableName} 不存在或有错误:`, error.message)
          results.errors.push({
            table: tableName,
            error: error.message,
            code: error.code
          })
          
          // 如果是表不存在的错误，尝试创建
          if (error.message.includes('does not exist')) {
            results.fixes.push({
              table: tableName,
              action: 'needs_creation',
              message: `表 ${tableName} 需要创建`
            })
          }
        } else {
          console.log(`✅ 表 ${tableName} 存在`)
          results.checks.push({
            table: tableName,
            status: 'exists',
            rowCount: data?.length || 0
          })
        }
      } catch (err) {
        console.error(`🚨 检查表 ${tableName} 时出错:`, err)
        results.errors.push({
          table: tableName,
          error: err instanceof Error ? err.message : '未知错误'
        })
      }
    }

    // 检查环境变量
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }

    results.environment = envCheck

    // 生成修复建议
    if (results.errors.length > 0) {
      results.recommendations = [
        '1. 在Supabase SQL编辑器中执行 scripts/setup-database.sql',
        '2. 确保所有环境变量正确配置',
        '3. 检查Supabase项目是否正常运行',
        '4. 验证service_role密钥权限'
      ]
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      message: results.errors.length === 0 
        ? '数据库检查通过' 
        : `发现 ${results.errors.length} 个问题`,
      data: results
    })

  } catch (error) {
    console.error('❌ 数据库检查失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '数据库检查失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 🔧 自动修复数据库问题
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 开始自动修复数据库...')
    
    const supabase = createAdminClient()
    const results: any = {
      timestamp: new Date().toISOString(),
      fixes: [],
      errors: []
    }

    // 尝试创建用户表（最关键的表）
    try {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR UNIQUE NOT NULL,
          name VARCHAR,
          image VARCHAR,
          credits INTEGER DEFAULT 100,
          location VARCHAR,
          last_signin_at TIMESTAMP WITH TIME ZONE,
          signin_count INTEGER DEFAULT 0,
          signin_type VARCHAR,
          signin_provider VARCHAR,
          signin_openid VARCHAR,
          signin_ip VARCHAR,
          preferred_currency VARCHAR DEFAULT 'USD',
          preferred_payment_provider VARCHAR,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `

      const { error: createError } = await supabase.rpc('exec_sql', { 
        sql: createUsersTable 
      })

      if (createError) {
        console.error('❌ 创建用户表失败:', createError)
        results.errors.push({
          action: 'create_users_table',
          error: createError.message
        })
      } else {
        console.log('✅ 用户表创建成功')
        results.fixes.push({
          action: 'create_users_table',
          status: 'success'
        })
      }
    } catch (err) {
      console.error('❌ 执行SQL失败:', err)
      results.errors.push({
        action: 'create_users_table',
        error: '无法执行SQL，请手动在Supabase中创建表'
      })
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      message: results.errors.length === 0 
        ? '数据库修复完成' 
        : `修复过程中遇到 ${results.errors.length} 个问题`,
      data: results,
      recommendation: results.errors.length > 0 
        ? '请手动在Supabase SQL编辑器中执行 scripts/setup-database.sql'
        : '数据库已准备就绪'
    })

  } catch (error) {
    console.error('❌ 数据库修复失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '数据库修复失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
} 