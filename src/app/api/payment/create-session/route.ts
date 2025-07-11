export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server"
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
  // 直接返回 mock 支付会话
  return respData({
    message: "Payment session created (mock)",
    sessionId: "mock-session-id",
    user: { email: "demo@mock.com", id: "mock" },
    amount: 100,
    currency: "USD"
  })
}) 