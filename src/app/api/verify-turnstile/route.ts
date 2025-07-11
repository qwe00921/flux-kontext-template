export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server"

// Cloudflare Turnstile API响应的类型定义
interface TurnstileResponse {
  success: boolean           // 验证是否成功
  "error-codes"?: string[]   // 错误代码数组（可选）
  challenge_ts?: string      // 挑战时间戳（可选）
  hostname?: string          // 主机名（可选）
  action?: string           // 动作名称（可选）
  cdata?: string            // 自定义数据（可选）
}

// 简化验证token的接口定义
interface FallbackToken {
  type: 'fallback'          // token类型标识
  timestamp: number         // 生成时间戳
  randomId: string          // 随机标识符
}

// POST请求处理函数 - 处理Turnstile验证请求
export async function POST(request: NextRequest) {
  try {
    // 解析请求体，获取验证token
    const { token } = await request.json()

    // 检查token是否存在
    if (!token) {
      return NextResponse.json(
        { success: false, error: "缺少验证token" },
        { status: 400 }
      )
    }

    // 🔄 处理备用验证token（以'fallback_'开头的token）
    if (token.startsWith('fallback_')) {
      console.log('🔄 处理备用验证token')
      
      // 解析备用token的结构：fallback_math_timestamp_randomId
      const tokenParts = token.split('_')
      if (tokenParts.length >= 3) {
        const timestamp = parseInt(tokenParts[2])  // 提取时间戳
        const currentTime = Date.now()
        const tokenAge = currentTime - timestamp   // 计算token年龄
        
        // 检查token是否在有效期内（10分钟）
        if (tokenAge < 10 * 60 * 1000) {
          return NextResponse.json({
            success: true,
            message: "备用验证成功",
            challenge_ts: new Date().toISOString(),
            hostname: request.headers.get("host") || "unknown",
            fallback: true
          })
        } else {
          // token已过期
          return NextResponse.json(
            { success: false, error: "备用验证token已过期" },
            { status: 400 }
          )
        }
      } else {
        // token格式无效
        return NextResponse.json(
          { success: false, error: "备用验证token格式无效" },
          { status: 400 }
        )
      }
    }

    // 🔐 处理Cloudflare Turnstile验证
    // 获取环境变量中的密钥
    const secretKey = process.env.TURNSTILE_SECRET_KEY
    if (!secretKey) {
      console.error("Turnstile密钥未配置")
      return NextResponse.json(
        { success: false, error: "服务器配置错误" },
        { status: 500 }
      )
    }

    // 准备发送给Cloudflare的验证数据
    const formData = new FormData()
    formData.append("secret", secretKey)      // 密钥
    formData.append("response", token)        // 用户的验证响应token
    
    // 🌐 获取客户端IP地址（用于验证）
    // 按优先级尝试不同的IP头部字段
    const clientIP = request.headers.get("cf-connecting-ip") ||     // Cloudflare IP
                    request.headers.get("x-forwarded-for") ||       // 代理转发IP
                    request.headers.get("x-real-ip") ||             // 真实IP
                    "unknown"                                       // 未知IP
    
    // 如果获取到有效IP，添加到验证数据中
    if (clientIP !== "unknown") {
      formData.append("remoteip", clientIP)
    }

    // 🕐 设置请求超时控制（10秒）
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      // 🚀 向Cloudflare Turnstile API发送验证请求
      const verifyResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: formData,
          signal: controller.signal  // 绑定超时控制器
        }
      )

      // 清除超时定时器
      clearTimeout(timeoutId)

      // 检查HTTP响应状态
      if (!verifyResponse.ok) {
        throw new Error(`Turnstile API返回状态码 ${verifyResponse.status}`)
      }

      // 解析Cloudflare的响应数据
      const result: TurnstileResponse = await verifyResponse.json()

      // ✅ 验证成功的处理
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "验证成功",
          challenge_ts: result.challenge_ts,
          hostname: result.hostname,
          fallback: false
        })
      } else {
        // ❌ 验证失败的处理
        console.error("Turnstile验证失败:", result["error-codes"])
        return NextResponse.json(
          {
            success: false,
            error: "人机验证失败",
            errorCodes: result["error-codes"]
          },
          { status: 400 }
        )
      }
    } catch (fetchError) {
      // 清除超时定时器
      clearTimeout(timeoutId)
      
      // 🕐 处理超时错误
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("Turnstile验证超时")
        return NextResponse.json(
          { success: false, error: "验证服务超时" },
          { status: 408 }
        )
      }
      
      // 重新抛出其他错误
      throw fetchError
    }
  } catch (error) {
    // 🚨 处理所有未捕获的错误
    console.error("Turnstile验证错误:", error)
    return NextResponse.json(
      { success: false, error: "验证服务错误" },
      { status: 500 }
    )
  }
}

// 🔧 工具函数：验证备用token的格式
function validateFallbackToken(token: string): boolean {
  // 检查token格式：fallback_math_timestamp_randomId
  const parts = token.split('_')
  if (parts.length < 4) return false
  if (parts[0] !== 'fallback') return false
  if (parts[1] !== 'math') return false
  
  // 验证时间戳是否为有效数字
  const timestamp = parseInt(parts[2])
  if (isNaN(timestamp)) return false
  
  // 验证随机ID是否存在
  if (!parts[3] || parts[3].length < 5) return false
  
  return true
}

// 🔧 工具函数：生成标准化的错误响应
function createErrorResponse(message: string, statusCode: number = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status: statusCode }
  )
}

// 🔧 工具函数：生成标准化的成功响应
function createSuccessResponse(data: any) {
  return NextResponse.json({
    success: true,
    ...data
  })
} 