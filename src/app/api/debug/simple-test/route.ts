export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'

// 🔍 简单测试API：逐步诊断问题
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始简单测试...')
    
    // 第1步：检查环境变量
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('🔍 环境变量检查:', {
      supabaseUrl: supabaseUrl ? 'SET' : 'NOT_SET',
      supabaseServiceKey: supabaseServiceKey ? 'SET' : 'NOT_SET'
    })
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: '环境变量缺失',
        details: {
          supabaseUrl: supabaseUrl ? 'SET' : 'NOT_SET',
          supabaseServiceKey: supabaseServiceKey ? 'SET' : 'NOT_SET'
        }
      }, { status: 500 })
    }
    
    // 第2步：尝试导入Supabase
    try {
      const { createServerClient } = await import('@supabase/ssr')
      console.log('✅ Supabase SSR导入成功')
      
      // 第3步：尝试创建客户端
      const supabase = createServerClient(
        supabaseUrl,
        supabaseServiceKey,
        {
          cookies: {
            getAll() { return [] },
            setAll() { /* 不需要设置cookies */ },
          },
        }
      )
      
      console.log('✅ Supabase客户端创建成功')
      
      // 第4步：尝试简单查询
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (error) {
        console.error('🚨 数据库查询失败:', error)
        return NextResponse.json({
          success: false,
          error: '数据库查询失败',
          details: error
        }, { status: 500 })
      }
      
      console.log('✅ 数据库查询成功')
      
      return NextResponse.json({
        success: true,
        message: '所有测试通过',
        steps: {
          step1_env: '✅ 环境变量检查通过',
          step2_import: '✅ Supabase导入成功',
          step3_client: '✅ 客户端创建成功',
          step4_query: '✅ 数据库查询成功'
        }
      })
      
    } catch (importError) {
      console.error('🚨 Supabase导入失败:', importError)
      return NextResponse.json({
        success: false,
        error: 'Supabase导入失败',
        details: importError instanceof Error ? importError.message : '未知错误'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('🚨 简单测试失败:', error)
    return NextResponse.json({
      success: false,
      error: '简单测试失败',
      details: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 