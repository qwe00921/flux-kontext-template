export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔍 数据库状态查看API
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始查看数据库状态...')
    
    const supabase = createAdminClient()
    const results: any = {
      timestamp: new Date().toISOString(),
      tables: {},
      summary: {}
    }

    // 检查各个表的数据统计
    const tables = [
      'users',
      'payment_orders', 
      'credit_transactions',
      'subscriptions',
      'payment_configs',
      'generations'
    ]

    for (const tableName of tables) {
      try {
        console.log(`🔍 检查表: ${tableName}`)
        
        // 获取表的记录数量
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (countError) {
          console.log(`❌ 表 ${tableName} 查询失败:`, countError.message)
          results.tables[tableName] = {
            exists: false,
            error: countError.message,
            count: 0
          }
        } else {
          console.log(`✅ 表 ${tableName} 存在，记录数: ${count}`)
          
          // 获取最近的几条记录作为示例
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(3)
            .order('created_at', { ascending: false })

          results.tables[tableName] = {
            exists: true,
            count: count || 0,
            sampleData: sampleError ? [] : sampleData,
            lastUpdated: sampleData?.[0]?.created_at || sampleData?.[0]?.updated_at
          }
        }
      } catch (err) {
        console.error(`🚨 检查表 ${tableName} 时出错:`, err)
        results.tables[tableName] = {
          exists: false,
          error: err instanceof Error ? err.message : '未知错误',
          count: 0
        }
      }
    }

    // 生成数据库摘要
    const existingTables = Object.keys(results.tables).filter(
      table => results.tables[table].exists
    )
    
    const totalRecords = Object.values(results.tables).reduce(
      (sum: number, table: any) => sum + (table.count || 0), 0
    )

    results.summary = {
      totalTables: tables.length,
      existingTables: existingTables.length,
      missingTables: tables.length - existingTables.length,
      totalRecords,
      databaseHealth: existingTables.length === tables.length ? 'healthy' : 'needs_setup'
    }

    // 生成建议
    const recommendations = []
    if (existingTables.length === 0) {
      recommendations.push('🚨 数据库未初始化，请在Supabase SQL编辑器中执行 scripts/setup-database.sql')
    } else if (existingTables.length < tables.length) {
      recommendations.push('⚠️ 部分表缺失，建议重新执行数据库初始化脚本')
    } else {
      recommendations.push('✅ 数据库结构完整')
      if (totalRecords === 0) {
        recommendations.push('💡 数据库为空，这是正常的初始状态')
      }
    }

    results.recommendations = recommendations

    return NextResponse.json({
      success: existingTables.length > 0,
      message: `数据库状态检查完成 - ${existingTables.length}/${tables.length} 表存在`,
      data: results
    })

  } catch (error) {
    console.error('❌ 数据库状态检查失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '数据库状态检查失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
} 