export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

// 🔍 用户测试API - 测试完整的用户操作流程
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始用户测试...')
    
    // 1. 检查session
    const session = await getServerSession(authOptions)
    console.log('🔍 Session检查:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasEmail: !!session?.user?.email,
      userEmail: session?.user?.email,
      userId: session?.user?.id
    })

    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'No session or email',
        sessionInfo: {
          hasSession: !!session,
          hasUser: !!session?.user,
          hasEmail: !!session?.user?.email
        }
      }, { status: 401 })
    }

    // 2. 测试Supabase直接连接
    console.log('🔍 测试Supabase直接连接...')
    const supabase = createAdminClient()
    
    const { data: directQuery, error: directError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .limit(1)
    
    console.log('🔍 Supabase直接查询结果:', {
      hasData: !!directQuery && directQuery.length > 0,
      dataLength: directQuery?.length || 0,
      error: directError?.message || null,
      userData: directQuery?.[0] || null
    })

    // 3. 如果用户不存在，测试创建用户
    let createResult = null
    if (!directQuery || directQuery.length === 0) {
      console.log('🔍 用户不存在，测试创建用户...')
      
      try {
        const testUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const now = new Date().toISOString()
        
        const newUserData = {
          id: testUserId,
          email: session.user.email,
          name: session.user.name || session.user.email,
          image: session.user.image || '',
          credits: 100,
          signin_type: 'oauth',
          signin_provider: 'google',
          signin_openid: session.user.id || '',
          signin_ip: 'test',
          last_signin_at: now,
          signin_count: 1,
          location: 'US',
          preferred_currency: 'USD',
          preferred_payment_provider: 'creem',
          created_at: now,
          updated_at: now
        }

        console.log('🔍 准备插入的用户数据:', newUserData)

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(newUserData)
          .select()
          .single()
        
        if (createError) {
          console.error('🚨 用户创建失败:', createError)
          createResult = { error: createError.message }
        } else {
          console.log('🎉 用户创建成功:', newUser.id)
          createResult = newUser
          
          // 创建积分记录
          try {
            const creditData = {
              id: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              user_id: newUser.id,
              amount: 100,
              type: 'gift',
              description: '测试用户创建赠送积分',
              reference_id: 'test_bonus',
              created_at: now,
              updated_at: now
            }

            const { error: creditError } = await supabase
              .from('credit_transactions')
              .insert(creditData)

            if (creditError) {
              console.error('⚠️ 积分记录创建失败:', creditError)
            } else {
              console.log('🎁 积分赠送记录创建成功')
            }
          } catch (creditError) {
            console.error('⚠️ 积分记录创建异常:', creditError)
          }
        }
        
      } catch (createError) {
        console.error('🚨 用户创建失败:', createError)
        createResult = { error: createError instanceof Error ? createError.message : '创建失败' }
      }
    }

    // 4. 再次查询确认
    let finalUser = null
    try {
      const { data: finalQuery, error: finalError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .limit(1)
        .single()

      if (!finalError && finalQuery) {
        finalUser = finalQuery
      }
    } catch (error) {
      console.error('🔍 最终查询错误:', error)
    }

    return NextResponse.json({
      success: true,
      testResults: {
        session: {
          hasSession: !!session,
          userEmail: session.user.email,
          userId: session.user.id
        },
        supabaseDirect: {
          hasData: !!directQuery && directQuery.length > 0,
          dataCount: directQuery?.length || 0,
          error: directError?.message || null,
          firstUser: directQuery?.[0] || null
        },
        userCreation: createResult,
        finalCheck: {
          userExists: !!finalUser,
          userCredits: finalUser?.credits || null,
          userId: finalUser?.id || null
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('🚨 用户测试失败:', error)
    
    return NextResponse.json({
      success: false,
      error: 'User test failed',
      details: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 