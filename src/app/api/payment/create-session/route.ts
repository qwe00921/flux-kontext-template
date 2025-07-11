export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { validateCheckoutParams, getPricingPage } from "@/lib/services/pricing"
import { createPaymentSession } from "@/lib/payment"
import { CheckoutParams, PricingItem } from "@/lib/types/pricing"
import { generateOrderNo } from "@/lib/utils/hash"
import { getIsoTimestr, addMonthsToDate } from "@/lib/utils/time"
import { 
  respData, 
  respErr, 
  respAuthErr, 
  respParamsErr, 
  respPaymentErr,
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  PaymentError
} from "@/lib/utils/response"

// 使用标准化错误处理包装API处理函数
export const POST = withErrorHandler(async (req: NextRequest) => {
  // 1. 验证用户认证
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    throw new AuthenticationError("Authentication required. Please sign in.")
  }

  // 2. 解析请求参数
  const body = await req.json()
  const {
    credits,
    currency,
    amount,
    interval,
    product_id,
    product_name,
    valid_months,
  } = body
  
  // 3. 设置取消URL，使用let声明以便重新赋值
  let cancel_url = body.cancel_url
  if (!cancel_url) {
    cancel_url = `${
      process.env.NEXT_PUBLIC_PAY_CANCEL_URL ||
      process.env.NEXT_PUBLIC_WEB_URL
    }/pricing`
  }

  // 4. 基础参数验证
  if (!amount || !interval || !currency || !product_id) {
    throw new ValidationError("Missing required parameters: amount, interval, currency, product_id")
  }

  // 5. 🔥 严格的产品参数验证 - 按照Shipany模板标准
  const page = await getPricingPage("en")
  if (!page || !page.pricing || !page.pricing.items) {
    throw new ValidationError("Invalid pricing configuration")
  }

  const item = page.pricing.items.find(
    (pricingItem: PricingItem) => pricingItem.product_id === product_id
  )

  if (!item) {
    throw new ValidationError("Product not found in pricing table")
  }

    // 🔥 严格验证所有产品参数是否匹配定价表
    if (
      item.amount !== amount ||
      item.interval !== interval ||
      item.currency !== currency ||
      item.credits !== credits ||
      item.valid_months !== valid_months ||
      item.product_name !== product_name
    ) {
      console.error("❌ 产品参数不匹配:", {
        expected: {
          amount: item.amount,
          interval: item.interval,
          currency: item.currency,
          credits: item.credits,
          valid_months: item.valid_months,
          product_name: item.product_name
        },
        received: {
          amount,
          interval,
          currency,
          credits,
          valid_months,
          product_name
        }
      })
      throw new ValidationError("Invalid checkout parameters - product parameters do not match pricing table")
    }

    console.log("✅ 产品参数验证通过:", {
      product_id,
      amount,
      currency,
      interval,
      valid_months
    })

  // 6. 验证interval类型
  if (!["year", "month", "one-time"].includes(interval)) {
    throw new ValidationError("Invalid interval. Must be 'year', 'month', or 'one-time'")
  }

  // 7. 验证订阅类型的valid_months
  const is_subscription = interval === "month" || interval === "year"
  
  if (interval === "year" && valid_months !== 12) {
    throw new ValidationError("Invalid valid_months for yearly subscription. Must be 12.")
  }

  if (interval === "month" && valid_months !== 1) {
    throw new ValidationError("Invalid valid_months for monthly subscription. Must be 1.")
  }

    // 8. 获取用户信息
    const userId = session.user.uuid || session.user.id
    const userEmail = session.user.email

    // 9. 🔥 计算订单过期时间 - 按照Shipany模板标准
    const currentDate = new Date()
    const created_at = getIsoTimestr()
    
    let expired_at = ""
    const timePeriod = addMonthsToDate(currentDate, valid_months)
    
    // 订阅类型延迟24小时过期
    if (is_subscription) {
      const delayTimeMillis = 24 * 60 * 60 * 1000 // 24小时
      const newTimeMillis = timePeriod.getTime() + delayTimeMillis
      expired_at = new Date(newTimeMillis).toISOString()
    } else {
      expired_at = timePeriod.toISOString()
    }

    console.log("✅ 订单时间计算:", {
      created_at,
      expired_at,
      valid_months,
      is_subscription
    })

    // 10. 创建支付会话
    const paymentResult = await createPaymentSession({
      userId,
      userEmail,
      productId: product_id,
      productName: product_name,
      amount,
      currency,
      productType: is_subscription ? "subscription" : "credits",
      billingCycle: is_subscription ? (interval as "monthly" | "yearly") : undefined,
      creditsAmount: credits,
    })

  if (!paymentResult.success) {
    console.error("❌ 支付会话创建失败:", paymentResult.error)
    throw new PaymentError(`Payment session creation failed: ${paymentResult.error}`)
  }

    console.log("✅ 支付会话创建成功:", {
      provider: paymentResult.provider,
      orderId: paymentResult.orderId,
      checkoutUrl: paymentResult.checkoutUrl
    })

  // 11. 返回成功响应 - 按照Shipany模板格式
  return respData({
    checkout_url: paymentResult.checkoutUrl,
    order_id: paymentResult.orderId,
    provider: paymentResult.provider,
    session_id: paymentResult.orderId, // 兼容前端
    public_key: paymentResult.provider === "stripe" ? process.env.STRIPE_PUBLIC_KEY : null,
    order_no: paymentResult.orderId, // Shipany格式兼容
  })
}) 