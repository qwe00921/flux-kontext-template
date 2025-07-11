export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔧 确保用户存在API - 如果用户不存在则自动创建
export async function POST(request: NextRequest) {
  try {
    // 直接返回 mock 用户存在结果
    return NextResponse.json({
      success: true,
      message: '用户已存在 (mock)',
      user: { id: 'mock', email: 'demo@mock.com', name: 'Demo User', credits: 100 },
      action: 'found'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

// 🔍 检查用户状态
export async function GET(request: NextRequest) {
  try {
    // 直接返回 mock 用户状态
    return NextResponse.json({
      success: true,
      exists: true,
      user: { id: 'mock', email: 'demo@mock.com', name: 'Demo User', credits: 100 }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 