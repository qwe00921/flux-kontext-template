export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { handleCreemWebhook } from '@/lib/payment/creem'

// 🔥 通用支付Webhook处理器
export async function POST(request: NextRequest) {
  try {
    // 🔍 获取请求体和各种可能的签名头
    const body = await request.text()
    const userAgent = request.headers.get('user-agent') || ''
    const contentType = request.headers.get('content-type') || ''
    
    // 🔍 检测支付提供商
    const paymentProvider = detectPaymentProvider(request, body)
    
    console.log(`收到支付Webhook请求 - 提供商: ${paymentProvider}`)

    switch (paymentProvider) {
      case 'creem':
        return await handleCreemPayment(request, body)
        
      case 'stripe':
        return await handleStripePayment(request, body)
        
      case 'paypal':
        return await handlePayPalPayment(request, body)
        
      default:
        console.error('未知的支付提供商:', paymentProvider)
        return NextResponse.json(
          { 
            success: false, 
            error: `不支持的支付提供商: ${paymentProvider}` 
          },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('通用支付Webhook处理异常:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '服务器内部错误' 
      },
      { status: 500 }
    )
  }
}

// 🔍 检测支付提供商
function detectPaymentProvider(request: NextRequest, body: string): string {
  // 🔥 通过请求头检测CREEM
  const creemSignature = request.headers.get('x-creem-signature') || 
                        request.headers.get('x-signature')
  if (creemSignature) {
    return 'creem'
  }

  // 🔥 通过请求头检测Stripe
  const stripeSignature = request.headers.get('stripe-signature')
  if (stripeSignature) {
    return 'stripe'
  }

  // 🔥 通过User-Agent检测PayPal
  const userAgent = request.headers.get('user-agent') || ''
  if (userAgent.includes('PayPal')) {
    return 'paypal'
  }

  // 🔥 通过请求体内容检测
  try {
    const data = JSON.parse(body)
    
    // CREEM特征检测
    if (data.type && (data.type.includes('checkout') || data.type.includes('subscription'))) {
      return 'creem'
    }
    
    // Stripe特征检测
    if (data.object && data.object === 'event') {
      return 'stripe'
    }
    
    // PayPal特征检测
    if (data.event_type || data.resource_type) {
      return 'paypal'
    }
  } catch (error) {
    console.log('无法解析请求体为JSON，使用默认检测')
  }

  // 🔥 默认返回CREEM（当前主要使用的支付方式）
  return 'creem'
}

// 🔥 处理CREEM支付
async function handleCreemPayment(request: NextRequest, body: string) {
  const signature = request.headers.get('x-creem-signature') || 
                   request.headers.get('x-signature') || 
                   request.headers.get('signature') || ''

  console.log('处理CREEM支付Webhook')
  
  const result = await handleCreemWebhook(body, signature)

  if (result.success) {
    console.log('CREEM Webhook处理成功:', result.event?.type)
    return NextResponse.json({ 
      success: true, 
      provider: 'creem',
      message: 'CREEM Webhook处理成功',
      eventType: result.event?.type 
    })
  } else {
    console.error('CREEM Webhook处理失败:', result.error)
    return NextResponse.json(
      { 
        success: false, 
        provider: 'creem',
        error: result.error 
      },
      { status: 400 }
    )
  }
}

// 🔥 处理Stripe支付（预留接口）
async function handleStripePayment(request: NextRequest, body: string) {
  console.log('处理Stripe支付Webhook')
  
  // TODO: 实现Stripe Webhook处理逻辑
  return NextResponse.json({
    success: true,
    provider: 'stripe',
    message: 'Stripe Webhook处理功能待实现'
  })
}

// 🔥 处理PayPal支付（预留接口）
async function handlePayPalPayment(request: NextRequest, body: string) {
  console.log('处理PayPal支付Webhook')
  
  // TODO: 实现PayPal Webhook处理逻辑
  return NextResponse.json({
    success: true,
    provider: 'paypal',
    message: 'PayPal Webhook处理功能待实现'
  })
}

// 🔥 支持GET请求用于验证端点
export async function GET() {
  return NextResponse.json({
    message: '通用支付Webhook端点正常运行',
    timestamp: new Date().toISOString(),
    endpoint: '/api/webhooks/payments',
    supportedProviders: ['creem', 'stripe', 'paypal'],
    currentPrimaryProvider: 'creem'
  })
} 