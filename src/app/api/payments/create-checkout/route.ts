export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createCreemCheckout, getCreemProductId } from '@/lib/payment/creem'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    // 🔐 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'User not logged in, please sign in before making payment' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      productType, 
      productId, 
      billingCycle, 
      amount, 
      currency = 'USD'
    } = body

    // 验证必需参数
    if (!productType || !productId || !amount) {
      return NextResponse.json(
        { error: '缺少必需参数：productType、productId 和 amount' },
        { status: 400 }
      )
    }

    // 🔍 获取用户信息
    // 🔧 使用Supabase替代Prisma，确保数据库访问一致性
    const { createAdminClient } = await import('@/lib/supabase/server')
    const supabase = createAdminClient()
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .limit(1)
      .single()

    if (userError || !user) {
      console.error('❌ 用户信息查询失败:', userError)
      return NextResponse.json(
        { error: '用户信息不存在，请重新登录' },
        { status: 404 }
      )
    }

    // 🛡️ 执行完整的安全检查
    console.log('🔒 开始支付安全验证...', {
      productType,
      productId,
      billingCycle,
      amount,
      currency,
      userId: user.id,
      userEmail: user.email
    })
    
    const securityChecks = await performSecurityChecks({
      productType: productType as 'subscription' | 'creditPack',
      productId,
      billingCycle,
      amount,
      currency,
      userId: user.id
    })

    // 🚨 安全检查失败 - 增强错误处理
    if (!securityChecks.passed) {
      console.error('🚨 Payment security check failed:', {
        errors: securityChecks.errors,
        warnings: securityChecks.warnings,
        productType,
        productId,
        amount,
        currency,
        userId: user.id,
        userEmail: user.email,
        billingCycle
      })
      
      // 🔧 详细错误分析
      console.error('🔍 Detailed error analysis:', {
        hasErrors: securityChecks.errors.length > 0,
        errorTypes: securityChecks.errors.map(err => {
          if (err.includes('Price validation failed')) return 'PRICE_VALIDATION'
          if (err.includes('Payment rate limit exceeded')) return 'RATE_LIMIT'
          if (err.includes('User does not exist')) return 'USER_NOT_FOUND'
          if (err.includes('duplicate order')) return 'DUPLICATE_ORDER'
          return 'UNKNOWN'
        }),
        rawErrors: securityChecks.errors
      })
      
      // 🔧 提供更友好的错误信息
      let userFriendlyError = 'Payment security verification failed'
      if (securityChecks.errors.some(err => err.includes('Price validation failed'))) {
        userFriendlyError = 'Product price verification failed, please refresh and try again'
      } else if (securityChecks.errors.some(err => err.includes('Payment rate limit exceeded'))) {
        userFriendlyError = 'Too many payment attempts, please try again later'
      } else if (securityChecks.errors.includes('User does not exist')) {
        userFriendlyError = 'User verification failed, please sign in again'
      } else if (securityChecks.errors.some(err => err.includes('duplicate order'))) {
        userFriendlyError = 'Duplicate order detected, please do not submit repeatedly'
      }
      
      return NextResponse.json(
        { 
          error: userFriendlyError,
          code: 'SECURITY_CHECK_FAILED',
          details: process.env.NODE_ENV === 'development' ? securityChecks.errors : undefined,
          warnings: securityChecks.warnings,
          suggestion: 'Please check your network connection and try again. Contact support if the issue persists.',
          debugInfo: process.env.NODE_ENV === 'development' ? {
            productType,
            productId,
            amount,
            currency,
            billingCycle,
            userId: user.id
          } : undefined
        },
        { status: 400 }
      )
    }

    // ⚠️ 显示警告（但不阻止支付）
    if (securityChecks.warnings.length > 0) {
      console.warn('⚠️ 支付安全警告:', securityChecks.warnings)
    }

    // 💰 重新验证价格（双重保险）
    const priceValidation = await validatePrice({
      productType: productType as 'subscription' | 'creditPack',
      productId,
      billingCycle,
      amount,
      currency,
      userId: user.id
    })

    if (!priceValidation.isValid) {
      console.error('💰 价格验证失败:', priceValidation.error)
      return NextResponse.json(
        { 
          error: 'Price verification failed',
          expectedPrice: priceValidation.expectedPrice,
          actualPrice: priceValidation.actualPrice,
          details: priceValidation.error
        },
        { status: 400 }
      )
    }

    console.log(`✅ 价格验证通过 - 产品: ${productType}/${productId}, 价格: $${amount}, 积分: ${priceValidation.credits}`)

    // 🔧 修复：对于免费计划，直接返回成功，跳转到generate页面
    if (priceValidation.expectedPrice === 0) {
      console.log(`🎁 免费计划检测到，直接跳转到generate页面`)
      return NextResponse.json({
        success: true,
        checkoutUrl: '/generate',
        orderId: 'free-plan',
        sessionId: 'free-plan',
        orderNumber: 'FREE-PLAN',
        validatedPrice: 0,
        expectedCredits: priceValidation.credits,
        isFree: true,
        securityChecks: {
          passed: true,
          warnings: securityChecks.warnings
        }
      })
    }

    // 🔧 获取内部产品ID用于数据库存储
    const mappingResult = mapCreemProductIdToInternal(productType as 'subscription' | 'creditPack', productId, billingCycle)
    const internalProductId = mappingResult.internalProductId

    console.log('🔄 产品ID映射 - 数据库存储:', {
      originalProductId: productId,
      internalProductId,
      billingCycle
    })

    // 🎯 生成订单号
    const orderNumber = `ORDER_${Date.now()}_${getUuid().slice(0, 8)}`
    const orderId = getUuid()
    
    const { data: paymentOrder, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        id: orderId,
        user_id: user.id,
        order_number: orderNumber,
        amount: priceValidation.expectedPrice, // 🔒 使用服务器验证的价格
        currency: currency,
        status: 'pending',
        payment_provider: 'creem',
        product_type: productType,
        product_id: internalProductId, // 🔧 使用内部产品ID存储
        product_name: `Flux Kontext ${productType === 'subscription' ? 'Subscription' : 'Credits'}`,
        customer_email: user.email,
        metadata: {
          billingCycle: billingCycle || 'one_time',
          originalProductId: productId, // 🔧 保存原始CREEM产品ID
          internalProductId: internalProductId, // 🔧 保存内部产品ID
          sessionUserId: session.user.id,
          sessionUserName: session.user.name,
          expectedCredits: priceValidation.credits,
          validationHash: priceValidation.validationHash,
          priceValidated: true,
          validatedAt: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (orderError || !paymentOrder) {
      console.error('❌ 支付订单创建失败:', orderError)
      return NextResponse.json(
        { error: 'Order creation failed, please try again' },
        { status: 500 }
      )
    }

    // 🔥 获取CREEM产品ID（使用原始产品ID）
    const creemProductId = getCreemProductId(productType, productId, billingCycle)

    // 🚀 创建CREEM支付会话（使用验证后的价格）
    const result = await createCreemCheckout({
      userId: user.id,
      email: user.email,
      amount: priceValidation.expectedPrice, // 🔒 使用服务器验证的价格
      currency: currency,
      productType: productType,
      productId: creemProductId, // 🔧 使用原始CREEM产品ID创建支付
      productName: paymentOrder.product_name,
      description: `订单号: ${orderNumber} | 积分: ${priceValidation.credits}`,
      metadata: {
        customerName: user.name || 'Customer',
        billingCycle: billingCycle || 'one_time',
        originalProductId: productId,
        internalProductId: internalProductId,
        orderNumber: orderNumber,
        paymentOrderId: paymentOrder.id,
        expectedCredits: priceValidation.credits,
        validationHash: priceValidation.validationHash
      }
    })

    if (!result.success) {
      // 🚨 支付创建失败，更新订单状态
      await supabase
        .from('payment_orders')
        .update({
          status: 'failed',
          metadata: {
            ...paymentOrder.metadata,
            error: result.error,
            failedAt: new Date().toISOString()
          }
        })
        .eq('id', paymentOrder.id)

      return NextResponse.json(
        { error: result.error || 'Payment creation failed' },
        { status: 500 }
      )
    }

    // ✅ 更新订单记录，添加CREEM会话信息
    await supabase
      .from('payment_orders')
      .update({
        creemCheckoutId: result.sessionId,
        status: 'created',
        metadata: {
          ...paymentOrder.metadata,
          creemCheckoutUrl: result.checkoutUrl,
          creemOrderId: result.orderId,
          createdAt: new Date().toISOString()
        }
      })
      .eq('id', paymentOrder.id)

    console.log(`🎉 支付会话创建成功 - 订单: ${orderNumber}, 会话: ${result.sessionId}`)

    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      orderId: result.orderId,
      sessionId: result.sessionId,
      orderNumber: orderNumber,
      validatedPrice: priceValidation.expectedPrice,
      expectedCredits: priceValidation.credits,
      securityChecks: {
        passed: true,
        warnings: securityChecks.warnings
      }
    })

  } catch (error) {
    console.error('创建支付会话失败:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 