export const runtime = 'edge';
import { NextRequest } from "next/server"
// import { getServerSession } from "next-auth"
import { respData, withErrorHandler } from "@/lib/utils/response"
import { runSystemMaintenance } from "@/lib/tasks/order-cleanup"

/**
 * 系统维护API - 只允许管理员访问
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  // 直接返回 mock 响应
  return respData({
    message: "System maintenance completed successfully (mock)",
    results: [],
    timestamp: new Date().toISOString(),
    triggeredBy: "demo@mock.com"
  })
})

/**
 * 获取系统状态 - 只允许管理员访问
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  // 直接返回 mock 响应
  return respData({
    system: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: 12345
    },
    orders: {},
    providers: {},
    environment: {
      nodeEnv: process.env.NODE_ENV,
      stripeEnabled: !!process.env.STRIPE_PRIVATE_KEY,
      creemEnabled: !!process.env.CREEM_API_KEY
    }
  })
}) 