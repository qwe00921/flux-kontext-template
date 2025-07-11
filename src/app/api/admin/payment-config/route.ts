export const runtime = 'edge';
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
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
  // 1. 验证管理员权限
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return respAuthErr("需要登录")
  }
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  if (!adminEmails.includes(session.user.email)) {
    return respAuthErr("需要管理员权限")
  }
  
  // 2. 获取支付系统状态
  const status = await getPaymentSystemStatus()
  
  return respData({
    status,
    timestamp: new Date().toISOString(),
    requestedBy: session.user.email
  })
})

/**
 * 更新支付系统配置 - 管理员专用
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  // 1. 验证管理员权限
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return respAuthErr("需要登录")
  }
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  if (!adminEmails.includes(session.user.email)) {
    return respAuthErr("需要管理员权限")
  }
  
  // 2. 解析请求参数
  const body = await req.json()
  const { action, ...params } = body
  
  console.log(`🔧 管理员 ${session.user.email} 执行支付配置操作: ${action}`)
  
  let result
  
  // 3. 根据操作类型执行相应功能
  switch (action) {
    case "update":
      // 更新配置
      result = await updatePaymentConfig(params, session.user.email)
      break
      
    case "switch":
      // 快速切换提供商
      if (!params.targetProvider) {
        throw new Error("缺少目标支付提供商")
      }
      result = await switchPaymentProvider(params.targetProvider, session.user.email)
      break
      
    case "maintenance_on":
      // 启用维护模式
      result = await enableMaintenanceMode(session.user.email, params.reason)
      break
      
    case "maintenance_off":
      // 禁用维护模式
      result = await disableMaintenanceMode(session.user.email)
      break
      
    default:
      throw new Error(`未知的操作类型: ${action}`)
  }
  
  // 4. 返回更新后的状态
  const newStatus = await getPaymentSystemStatus()
  
  return respData({
    message: "支付配置更新成功",
    config: result,
    status: newStatus,
    timestamp: new Date().toISOString(),
    updatedBy: session.user.email
  })
}) 