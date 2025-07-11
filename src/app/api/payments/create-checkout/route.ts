export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createCreemCheckout, getCreemProductId } from '@/lib/payment/creem'
import { prisma } from '@/lib/database'
import { getUuid } from '@/lib/utils/hash'
import { 
  validatePrice, 
  performSecurityChecks, 
  checkDuplicateOrder,
  checkPaymentRateLimit,
  STANDARD_PRICING,
  mapCreemProductIdToInternal
} from '@/lib/payment-security'

// 🔥 创建CREEM支付会话API
export async function POST(request: NextRequest) {
  try {
    // 直接返回 mock 支付会话
    return NextResponse.json({
      success: true,
      message: 'CREEM checkout created (mock)',
      user: { email: 'demo@mock.com', id: 'mock' },
      checkoutId: 'mock-checkout-id',
      amount: 100,
      currency: 'USD'
    })
  } catch (error) {
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
} 