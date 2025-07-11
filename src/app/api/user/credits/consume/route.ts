export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { getUuid } from '@/lib/utils/hash'

// 🔥 消耗用户积分API
export async function POST(request: NextRequest) {
  try {
    // 🔐 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      amount = 2, // 默认消耗2积分
      action = 'image_generation', // 操作类型
      description = 'AI图像生成',
      metadata = {} 
    } = body

    // 验证积分数量
    if (amount <= 0) {
      return NextResponse.json(
        { error: '积分消耗数量必须大于0' },
        { status: 400 }
      )
    }

    // 🔍 使用Supabase获取用户信息
    const supabase = createAdminClient()
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: '用户信息不存在' },
        { status: 404 }
      )
    }

    // 💰 检查积分余额
    const currentCredits = user.credits || 0
    if (currentCredits < amount) {
      return NextResponse.json(
        { 
          error: '积分余额不足',
          currentCredits,
          requiredCredits: amount,
          shortfall: amount - currentCredits
        },
        { status: 400 }
      )
    }

    // 🔄 扣除积分
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        credits: currentCredits - amount
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('🚨 积分扣除失败:', updateError)
      return NextResponse.json(
        { error: '积分扣除失败' },
        { status: 500 }
      )
    }

    // 📝 创建积分消耗记录
    const transactionData = {
      id: getUuid(),
      user_id: user.id,
      amount: -amount, // 负数表示消耗
      type: 'usage',
      description: description,
      reference_id: `${action}_${Date.now()}`,
      metadata: {
        action,
        sessionId: session.user.id,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('credit_transactions')
      .insert(transactionData)
      .select()
      .single()

    if (transactionError) {
      console.error('⚠️ 积分交易记录创建失败:', transactionError)
    }

    return NextResponse.json({
      success: true,
      message: `成功消耗${amount}积分`,
      transaction: {
        id: transaction?.id,
        amount: amount,
        description: transactionData.description,
        createdAt: transaction?.created_at
      },
      user: {
        id: user.id,
        email: user.email,
        creditsBeforeConsumption: currentCredits,
        creditsAfterConsumption: updatedUser.credits,
        creditsConsumed: amount
      }
    })

  } catch (error) {
    console.error('积分消耗失败:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 🔥 检查积分余额API
export async function GET(request: NextRequest) {
  try {
    // 🔐 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      )
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const requiredCredits = parseInt(searchParams.get('required') || '2')

    // 🔍 使用Supabase获取用户积分
    const supabase = createAdminClient()
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, credits')
      .eq('email', session.user.email)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: '用户信息不存在' },
        { status: 404 }
      )
    }

    const currentCredits = user.credits || 0
    const hasEnoughCredits = currentCredits >= requiredCredits

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        credits: currentCredits
      },
      check: {
        requiredCredits,
        hasEnoughCredits,
        shortfall: hasEnoughCredits ? 0 : requiredCredits - currentCredits
      }
    })

  } catch (error) {
    console.error('积分检查失败:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 