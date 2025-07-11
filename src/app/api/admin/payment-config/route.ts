export const runtime = 'edge';
import { NextRequest } from "next/server"
import { 
  respData, 
  respAuthErr, 
  respInternalErr,
  withErrorHandler 
} from "@/lib/utils/response"
import {
  getPaymentSystemStatus,
  updatePaymentConfig,
  switchPaymentProvider,
  enableMaintenanceMode,
  disableMaintenanceMode
} from "@/lib/services/payment-config"

/**
 * 获取支付系统状态 - 管理员专用
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  // 直接返回 mock 响应
  return respData({
    status: { payment: "ok", provider: "mock" },
    timestamp: new Date().toISOString(),
    requestedBy: "demo@mock.com"
  })
})

/**
 * 更新支付系统配置 - 管理员专用
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  // 直接返回 mock 响应
  return respData({
    message: "支付配置更新成功 (mock)",
    config: {},
    status: { payment: "ok", provider: "mock" },
    timestamp: new Date().toISOString(),
    updatedBy: "demo@mock.com"
  })
}) 