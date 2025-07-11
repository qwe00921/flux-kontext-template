import { 
  CreatePaymentParams, 
  PaymentResponse, 
  Currency 
} from "@/lib/types/payment";
import { formatAmountForProvider } from "./router";
import { prisma } from '@/lib/database';
import { getUuid } from '@/lib/utils/hash';

// 🎯 CREEM Product ID Mapping Configuration - 与后台产品名称完全匹配
export const CREEM_PRODUCT_IDS = {
  // Subscription Plans - 与CREEM后台产品名称完全匹配
  subscriptions: {
    plus: {
      monthly: "FluxKontext-Plus-Monthly",  // $9.90/month
      yearly: "FluxKontext-Plus-Yearly"    // $99.00/year
    },
    pro: {
      monthly: "FluxKontext-Pro-Monthly",  // $29.90/month
      yearly: "FluxKontext-Pro-Yearly"     // $299.00/year
    }
    // Note: Basic plan is free and doesn't need CREEM product IDs
  },
  // Credit Packs - 与CREEM后台产品名称完全匹配
  creditPacks: {
    starter: "Starter Pack",    // $4.90
    creator: "Creator Pack",    // $15.00
    business: "Business Pack"   // $60.00
  }
} as const;

// 🔥 根据产品类型获取CREEM产品ID
export function getCreemProductId(
  productType: string, 
  productId: string, 
  billingCycle?: 'monthly' | 'yearly'
): string {
  if (productType === 'subscription' && billingCycle) {
    const subscriptionMap = CREEM_PRODUCT_IDS.subscriptions[productId as keyof typeof CREEM_PRODUCT_IDS.subscriptions];
    return subscriptionMap?.[billingCycle] || productId;
  }
  
  if (productType === 'creditPack') {
    return CREEM_PRODUCT_IDS.creditPacks[productId as keyof typeof CREEM_PRODUCT_IDS.creditPacks] || productId;
  }
  
  return productId;
}

// 🔥 CREEM API Configuration - Build-time Safe Version
function getCreemConfig() {
  const CREEM_API_URL = process.env.CREEM_API_URL;
  const CREEM_API_KEY = process.env.CREEM_API_KEY;
  const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;
  
  // Don't throw errors during build time, only check at runtime
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    // Only check on server-side in production
    if (!CREEM_API_URL || !CREEM_API_KEY) {
      console.warn("CREEM API configuration missing: Please check CREEM_API_URL and CREEM_API_KEY environment variables");
    }
  }
  
  return {
    CREEM_API_URL: CREEM_API_URL || "",
    CREEM_API_KEY: CREEM_API_KEY || "",
    CREEM_WEBHOOK_SECRET: CREEM_WEBHOOK_SECRET || ""
  };
}

// 🔥 CREEM支付创建接口 - 修复为符合API规范的接口
interface CreemCheckoutRequest {
  product_id: string;
  customer: {
    email: string;
    name?: string;
  };
  metadata: {
    user_id: string;
    product_type: string;
    product_id?: string;
    [key: string]: any;
  };
  success_url?: string;
  request_id?: string;
  units?: number;
}

// 🔥 CREEM响应接口
interface CreemCheckoutResponse {
  id: string;
  checkout_url: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
}

// 🔥 创建CREEM支付会话
export async function createCreemCheckout(params: CreatePaymentParams): Promise<PaymentResponse> {
  try {
    const { CREEM_API_URL, CREEM_API_KEY } = getCreemConfig();
    
    // 运行时检查配置
    if (!CREEM_API_URL || !CREEM_API_KEY) {
      return {
        success: false,
        orderId: "",
        provider: "creem",
        error: "CREEM API configuration missing: Please check CREEM_API_URL and CREEM_API_KEY environment variables",
      };
    }

    const {
      userId,
      email,
      amount,
      currency,
      productType,
      productId,
      productName,
      description,
      metadata = {}
    } = params;

    // 获取正确的CREEM产品ID
    const creemProductId = getCreemProductId(productType, productId || `${productType}_${Date.now()}`, metadata.billingCycle as 'monthly' | 'yearly');

    // 构建请求体 - 只使用CREEM API支持的参数
    const requestBody: CreemCheckoutRequest = {
      product_id: creemProductId,
      customer: {
        email,
        name: metadata.customerName,
      },
      metadata: {
        user_id: userId,
        product_type: productType,
        product_id: productId || "",
        product_name: productName || "Flux Kontext Credits",
        description: description || "",
        original_amount: amount, // 保存原始金额用于记录
        original_currency: currency, // 保存原始货币用于记录
        ...metadata,
      },
      success_url: `${process.env.NEXT_PUBLIC_WEB_URL}/payment/success`,
      request_id: getUuid(),
      units: 1, // 默认购买1个单位的产品
    };

    // 发送请求到CREEM API
    const response = await fetch(`${CREEM_API_URL}/checkouts`, {
      method: "POST",
      headers: {
        "x-api-key": CREEM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `CREEM API error: ${response.status}`);
    }

    const data: CreemCheckoutResponse = await response.json();

    return {
      success: true,
      orderId: data.id,
      checkoutUrl: data.checkout_url,
      sessionId: data.id,
      provider: "creem",
    };
  } catch (error) {
    console.error("CREEM payment creation failed:", error);
    return {
      success: false,
      orderId: "",
      provider: "creem",
      error: error instanceof Error ? error.message : "payment creation failed",
    };
  }
}

// 🔥 CREEM Webhook事件接口
interface CreemWebhookEvent {
  id: string;
  type: string;
  data: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
      name?: string;
    };
    metadata: {
      user_id: string;
      product_type: string;
      [key: string]: any;
    };
    created_at: string;
    paid_at?: string;
  };
  created_at: string;
}

// 🔥 处理CREEM Webhook
export async function handleCreemWebhook(
  body: string,
  signature: string
): Promise<{ success: boolean; event?: CreemWebhookEvent; error?: string }> {
  try {
    // 验证签名
    const { CREEM_WEBHOOK_SECRET } = getCreemConfig();
    
    if (!CREEM_WEBHOOK_SECRET) {
      return {
        success: false,
        error: "CREEM Webhook secret not configured"
      };
    }
    
    const expectedSignature = btoa(body + CREEM_WEBHOOK_SECRET).substring(0, 16);

    if (signature !== expectedSignature) {
      return {
        success: false,
        error: "Invalid Webhook signature"
      };
    }

    const event: CreemWebhookEvent = JSON.parse(body);
    console.log(`Received CREEM Webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.completed":
        await handleCheckoutCompleted(event.data);
        break;
        
      case "checkout.failed":
        await handleCheckoutFailed(event.data);
        break;
        
      case "checkout.cancelled":
        await handleCheckoutCancelled(event.data);
        break;
        
      case "subscription.created":
        await handleSubscriptionCreated(event.data);
        break;
        
      case "subscription.updated":
        await handleSubscriptionUpdated(event.data);
        break;
        
      case "subscription.cancelled":
        await handleSubscriptionCancelled(event.data);
        break;
        
      default:
        console.log(`Unhandled CREEM event type: ${event.type}`);
    }

    return {
      success: true,
      event
    };
  } catch (error) {
    console.error("CREEM Webhook processing failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook processing failed"
    };
  }
}

// 🔥 处理支付完成
async function handleCheckoutCompleted(data: CreemWebhookEvent["data"]) {
  try {
    const { metadata, amount, currency } = data;
    const { user_id, product_type, orderNumber, paymentOrderId, expectedCredits, validationHash } = metadata;

    console.log(`CREEM payment completed - User: ${user_id}, Product: ${product_type}, Amount: ${amount} ${currency}`);
    
    // 🔍 查找支付订单
    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: {
        OR: [
          { id: paymentOrderId },
          { orderNumber: orderNumber },
          { creemCheckoutId: data.id }
        ]
      }
    });

    if (!paymentOrder) {
      console.error(`Payment order not found: ${paymentOrderId || orderNumber || data.id}`);
      return;
    }

    // 🛡️ 订单完整性验证
    console.log('🔒 Starting order integrity verification...')
    
    // 1️⃣ 验证订单状态
    if (paymentOrder.status === 'completed') {
      console.warn(`⚠️ Order already completed, skipping duplicate processing: ${paymentOrder.orderNumber}`)
      return;
    }

    // 2️⃣ 验证金额匹配
    const amountDifference = Math.abs(paymentOrder.amount - amount)
    if (amountDifference > 0.01) {
      console.error(`💰 Amount mismatch - Order: $${paymentOrder.amount}, Webhook: $${amount}`)
      
      // 标记订单为异常
      await prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: 'failed',
          metadata: {
            ...paymentOrder.metadata,
            error: `Amount mismatch: Order$${paymentOrder.amount} vs Webhook$${amount}`,
            failedAt: new Date().toISOString()
          }
        }
      });
      return;
    }

    // 3️⃣ 验证用户匹配
    if (paymentOrder.userId !== user_id) {
      console.error(`👤 User mismatch - Order: ${paymentOrder.userId}, Webhook: ${user_id}`)
      
      await prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: 'failed',
          metadata: {
            ...paymentOrder.metadata,
            error: `User mismatch: ${paymentOrder.userId} vs ${user_id}`,
            failedAt: new Date().toISOString()
          }
        }
      });
      return;
    }

    // 4️⃣ 验证产品类型匹配
    if (paymentOrder.productType !== product_type) {
      console.error(`📦 Product type mismatch - Order: ${paymentOrder.productType}, Webhook: ${product_type}`)
      
      await prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: 'failed',
          metadata: {
            ...paymentOrder.metadata,
            error: `Product type mismatch: ${paymentOrder.productType} vs ${product_type}`,
            failedAt: new Date().toISOString()
          }
        }
      });
      return;
    }

    // 5️⃣ 验证哈希（如果存在）
    if (validationHash && paymentOrder.metadata?.validationHash) {
      if (validationHash !== paymentOrder.metadata.validationHash) {
        console.error(`🔐 Validation hash mismatch`)
        
        await prisma.paymentOrder.update({
          where: { id: paymentOrder.id },
          data: {
            status: 'failed',
            metadata: {
              ...paymentOrder.metadata,
              error: 'Validation hash mismatch, possible tampering',
              failedAt: new Date().toISOString()
            }
          }
        });
        return;
      }
    }

    console.log('✅ Order integrity verification passed')

    // 🔄 更新支付订单状态
    await prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: 'completed',
        paidAt: new Date(),
        creemPaymentId: data.id,
        metadata: {
          ...paymentOrder.metadata,
          completedAt: new Date().toISOString(),
          creemData: data,
          integrityVerified: true
        }
      }
    });

    // 🎯 根据产品类型处理业务逻辑
    if (product_type === 'creditPack') {
      // 💰 积分包：发放积分
      let creditsToAdd: number;
      
      // 优先使用验证过的积分数量
      if (expectedCredits && typeof expectedCredits === 'number') {
        creditsToAdd = expectedCredits;
        console.log(`Using verified credit quantity: ${creditsToAdd}`)
      } else {
        // 回退到计算方式
        creditsToAdd = calculateCreditsFromProduct(paymentOrder.productId, amount);
        console.log(`Using calculated credit quantity: ${creditsToAdd}`)
      }
      
      // 更新用户积分
      await prisma.user.update({
        where: { id: user_id },
        data: {
          credits: {
            increment: creditsToAdd
          }
        }
      });

      // 创建积分交易记录
      await prisma.creditTransaction.create({
        data: {
          id: getUuid(),
          userId: user_id,
          amount: creditsToAdd,
          type: 'purchase',
          description: `Purchased credit pack: ${paymentOrder.productName}`,
          paymentOrderId: paymentOrder.id,
          referenceId: data.id
        }
      });

      console.log(`✅ Credit addition successful - User: ${user_id}, Credits: ${creditsToAdd}`);

    } else if (product_type === 'subscription') {
      // 📅 订阅计划：创建或更新订阅
      const billingCycle = metadata.billingCycle || 'monthly';
      const planId = paymentOrder.productId;
      
      // 计算订阅周期
      const now = new Date();
      const periodEnd = new Date(now);
      if (billingCycle === 'yearly') {
        periodEnd.setFullYear(now.getFullYear() + 1);
      } else {
        periodEnd.setMonth(now.getMonth() + 1);
      }

      // 查找现有订阅
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          userId: user_id,
          status: 'active'
        }
      });

      if (existingSubscription) {
        // 更新现有订阅
        await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            planId: planId,
            billingCycle: billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            creemSubscriptionId: data.id
          }
        });
        
        console.log(`✅ Subscription update successful - User: ${user_id}, Plan: ${planId}`)
      } else {
        // 创建新订阅
        await prisma.subscription.create({
          data: {
            id: getUuid(),
            userId: user_id,
            planId: planId,
            status: 'active',
            billingCycle: billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            paymentProvider: 'creem',
            creemSubscriptionId: data.id
          }
        });
        
        console.log(`✅ Subscription creation successful - User: ${user_id}, Plan: ${planId}`)
      }
    }

    console.log(`🎉 Payment processing completed - Order: ${paymentOrder.orderNumber}`)

  } catch (error) {
    console.error('Payment completion event processing failed:', error);
    throw error;
  }
}

// 🔥 处理支付失败
async function handleCheckoutFailed(data: CreemWebhookEvent["data"]) {
  try {
    const { metadata } = data;
    const { user_id, orderNumber, paymentOrderId } = metadata;

    console.log(`CREEM payment failed - User: ${user_id}, Order: ${data.id}`);
    
    // 🔍 查找并更新支付订单状态
    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: {
        OR: [
          { id: paymentOrderId },
          { orderNumber: orderNumber },
          { creemCheckoutId: data.id }
        ]
      }
    });

    if (paymentOrder) {
      await prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: 'failed',
          metadata: {
            ...paymentOrder.metadata,
            failedAt: new Date().toISOString(),
            failureReason: 'payment_failed',
            creemData: data
          }
        }
      });
    }
  } catch (error) {
    console.error("CREEM payment failure event processing failed:", error);
  }
}

// 🔥 处理支付取消
async function handleCheckoutCancelled(data: CreemWebhookEvent["data"]) {
  try {
    const { metadata } = data;
    const { user_id, orderNumber, paymentOrderId } = metadata;

    console.log(`CREEM payment cancelled - User: ${user_id}, Order: ${data.id}`);
    
    // 🔍 查找并更新支付订单状态
    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: {
        OR: [
          { id: paymentOrderId },
          { orderNumber: orderNumber },
          { creemCheckoutId: data.id }
        ]
      }
    });

    if (paymentOrder) {
      await prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: 'cancelled',
          metadata: {
            ...paymentOrder.metadata,
            cancelledAt: new Date().toISOString(),
            creemData: data
          }
        }
      });
    }
  } catch (error) {
    console.error("CREEM payment cancellation event processing failed:", error);
  }
}

// 🔥 处理订阅创建
async function handleSubscriptionCreated(data: CreemWebhookEvent["data"]) {
  try {
    const { metadata } = data;
    const { user_id } = metadata;

    console.log(`CREEM subscription created - User: ${user_id}, Subscription: ${data.id}`);
    
    // 订阅创建逻辑已在 handleCheckoutCompleted 中处理
    // 这里可以添加额外的订阅创建后处理逻辑
  } catch (error) {
    console.error("CREEM subscription creation event processing failed:", error);
  }
}

// 🔥 处理订阅更新
async function handleSubscriptionUpdated(data: CreemWebhookEvent["data"]) {
  try {
    console.log(`CREEM subscription updated - Subscription: ${data.id}, Status: ${data.status}`);
    
    // 🔍 查找并更新订阅状态
    const subscription = await prisma.subscription.findFirst({
      where: { creemSubscriptionId: data.id }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: data.status === 'active' ? 'active' : 'inactive'
        }
      });
    }
  } catch (error) {
    console.error("CREEM subscription update event processing failed:", error);
  }
}

// 🔥 处理订阅取消
async function handleSubscriptionCancelled(data: CreemWebhookEvent["data"]) {
  try {
    console.log(`CREEM subscription cancelled - Subscription: ${data.id}`);
    
    // 🔍 查找并更新订阅状态
    const subscription = await prisma.subscription.findFirst({
      where: { creemSubscriptionId: data.id }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled'
        }
      });
    }
  } catch (error) {
    console.error("CREEM subscription cancellation event processing failed:", error);
  }
}

// 🔥 根据产品ID计算积分数量
function calculateCreditsFromProduct(productId: string, amount: number): number {
  // 根据产品ID映射积分数量
  const creditMapping: Record<string, number> = {
    'starter': 600,
    'creator': 4000,
    'business': 18000,
  };
  
  return creditMapping[productId] || Math.floor(amount / 100) * 100; // 默认：$1 = 100积分
}

// 🔥 获取CREEM支付详情
export async function getCreemCheckout(checkoutId: string) {
  try {
    const { CREEM_API_URL, CREEM_API_KEY } = getCreemConfig();
    const response = await fetch(`${CREEM_API_URL}/checkouts/${checkoutId}`, {
      method: "GET",
      headers: {
        "x-api-key": CREEM_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`CREEM API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("CREEM payment details retrieval failed:", error);
    throw error;
  }
}

// 🔥 创建CREEM产品
export async function createCreemProduct(params: {
  name: string;
  description?: string;
  price: number;
  currency: Currency;
  type: "one_time" | "recurring";
  interval?: "month" | "year";
}) {
  try {
    const { CREEM_API_URL, CREEM_API_KEY } = getCreemConfig();
    const response = await fetch(`${CREEM_API_URL}/products`, {
      method: "POST",
      headers: {
        "x-api-key": CREEM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`CREEM API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("CREEM product creation failed:", error);
    throw error;
  }
}

// 🔥 验证CREEM API连接
export async function validateCreemConnection(): Promise<boolean> {
  try {
    const { CREEM_API_URL, CREEM_API_KEY } = getCreemConfig();
    const response = await fetch(`${CREEM_API_URL}/ping`, {
      method: "GET",
      headers: {
        "x-api-key": CREEM_API_KEY,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("CREEM connection validation failed:", error);
    return false;
  }
}

// 🔥 根据金额和货币计算积分数量（示例逻辑）
function calculateCreditsFromAmount(amount: number, currency: string): number {
  // 这里可以根据实际业务逻辑调整积分计算规则
  const rates: Record<string, number> = {
    usd: 100, // $1 = 100 积分
    cny: 15,  // ¥1 = 15 积分
    eur: 110, // €1 = 110 积分
  };
  
  const rate = rates[currency.toLowerCase()] || 100;
  return Math.floor((amount / 100) * rate); // amount是最小单位，需要除以100
} 