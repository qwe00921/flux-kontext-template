export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 🔥 获取用户积分信息
export async function GET(request: NextRequest) {
  try {
    // 直接返回 mock 用户积分信息
    return NextResponse.json({
      success: true,
      user: {
        id: 'mock',
        email: 'demo@mock.com',
        name: 'Demo User',
        credits: 100,
        memberSince: '2024-01-01T00:00:00Z'
      },
      creditTransactions: [],
      activeSubscription: null,
      summary: {
        totalCredits: 100,
        hasActiveSubscription: false,
        subscriptionPlan: null,
        subscriptionExpiry: null
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 