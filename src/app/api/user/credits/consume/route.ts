export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUuid } from '@/lib/utils/hash'

// 🔥 消耗用户积分API
export async function POST(request: NextRequest) {
  try {
    // 直接返回 mock 消耗结果
    return NextResponse.json({
      success: true,
      message: '积分消耗成功 (mock)',
      user: { id: 'mock', email: 'demo@mock.com', credits: 98 }
    })
  } catch (error) {
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

// 🔥 检查积分余额API
export async function GET(request: NextRequest) {
  try {
    // 直接返回 mock 检查结果
    return NextResponse.json({
      success: true,
      user: { id: 'mock', email: 'demo@mock.com', credits: 98 },
      check: { requiredCredits: 2, hasEnoughCredits: true, shortfall: 0 }
    })
  } catch (error) {
    return NextResponse.json({
      error: '服务器内部错误'
    }, { status: 500 })
  }
} 