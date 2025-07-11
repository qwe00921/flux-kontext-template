export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔍 用户测试API - 测试完整的用户操作流程
export async function GET(request: NextRequest) {
  try {
    // 直接返回 mock 用户测试数据
    return NextResponse.json({
      success: true,
      message: '用户测试API (mock)',
      sessionInfo: { hasSession: true, hasUser: true, hasEmail: true },
      user: { email: 'demo@mock.com', id: 'mock' },
      directQuery: [],
      debug: '已跳过所有登录校验 (mock)'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 