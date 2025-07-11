export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server"
import { FluxKontextService } from "@/lib/flux-kontext"
import { consumeCreditsForImageGeneration, checkUserCredits } from '@/lib/services/credits';
import { prisma } from '@/lib/database';
import { ContentSafetyService } from '@/lib/content-safety';

// 初始化内容安全服务
const contentSafety = new ContentSafetyService({
  enablePreFilter: true,
  enablePostFilter: true,
  enableRealTimeMonitor: true,
  strictMode: false,
  providers: []
});

// Turnstile验证函数 - 优化版本
async function verifyTurnstileToken(token: string, clientIP: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error("❌ Turnstile secret key not configured");
    return false;
  }

  console.log(`🔑 Starting Turnstile token verification (first 10 chars): ${token.substring(0, 10)}...`);

  // 添加重试机制和更宽松的验证
  const maxRetries = 3; // 增加重试次数
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("secret", secretKey);
      formData.append("response", token);
      
      // 只有在IP不是unknown时才添加
      if (clientIP && clientIP !== "unknown" && clientIP !== "127.0.0.1") {
        formData.append("remoteip", clientIP);
        console.log(`🌐 Adding client IP: ${clientIP} (attempt ${attempt}/${maxRetries})`);
      } else {
        console.log(`🌐 Skipping IP verification (IP: ${clientIP}) (attempt ${attempt}/${maxRetries})`);
      }

      console.log(`🚀 Sending Turnstile verification request... (attempt ${attempt}/${maxRetries})`);
      const verifyResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: formData,
          headers: {
            'User-Agent': 'FluxKontext/1.0'
          },
          // 增加超时时间
          signal: AbortSignal.timeout(15000) // 15秒超时
        }
      );

      if (!verifyResponse.ok) {
        const errorMsg = `❌ Turnstile API response error: ${verifyResponse.status} ${verifyResponse.statusText}`;
        console.error(errorMsg);
        lastError = new Error(errorMsg);
        
        // 如果是服务器错误，尝试重试
        if (verifyResponse.status >= 500 && attempt < maxRetries) {
          console.log(`⏳ Server error, retrying after ${2000 * attempt}ms...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        
        // 如果是客户端错误，可能是token问题，但仍然重试一次
        if (verifyResponse.status >= 400 && verifyResponse.status < 500 && attempt < maxRetries) {
          console.log(`⏳ Client error, retrying after ${1000 * attempt}ms...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return false;
      }

      const result = await verifyResponse.json();
      console.log(`📋 Turnstile verification response (attempt ${attempt}):`, {
        success: result.success,
        'error-codes': result['error-codes'],
        challenge_ts: result.challenge_ts,
        hostname: result.hostname,
        action: result.action
      });

      // 成功验证
      if (result.success === true) {
        console.log(`✅ Turnstile verification successful (attempt ${attempt})`);
        return true;
      }

      // 处理验证失败
      if (result['error-codes']) {
        const errorCodes = result['error-codes'];
        console.warn(`⚠️ Turnstile verification failed, error codes:`, errorCodes);
        
        // 检查是否是可重试的错误
        const retryableErrors = [
          'timeout-or-duplicate', 
          'internal-error',
          'invalid-input-response', // 有时token格式问题可以重试
          'bad-request'
        ];
        const hasRetryableError = errorCodes.some((code: string) => retryableErrors.includes(code));
        
        // 特殊处理：如果是hostname不匹配但其他都正常，可能是开发环境问题
        const hasHostnameError = errorCodes.includes('hostname-mismatch');
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        if (hasHostnameError && isDevelopment) {
          console.log(`🔧 Development environment detected hostname mismatch, but allowing pass`);
          return true;
        }
        
        if (hasRetryableError && attempt < maxRetries) {
          console.log(`⏳ Detected retryable error, retrying after ${2000 * attempt}ms...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        
        // 记录具体的错误信息
        lastError = new Error(`Turnstile verification failed: ${errorCodes.join(', ')}`);
      }

      // 如果到这里说明验证失败且不可重试
      break;

    } catch (error) {
      console.error(`❌ Turnstile verification network error (attempt ${attempt}):`, error);
      lastError = error;
      
      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        console.log(`⏳ Network error, retrying after ${2000 * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
    }
  }

  console.error(`❌ Turnstile verification final failure, attempted ${maxRetries} times:`, lastError);
  return false;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting image generation request at:', new Date().toISOString());
    
    // 设置请求超时检测
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout: Generation took longer than 55 seconds'))
      }, 55000) // 55秒超时，留5秒缓冲
    });

    // 包装主要逻辑在Promise中
    const mainLogic = async () => {
      const body = await request.json();
      console.log('📝 Request body received:', {
        action: body.action,
        prompt: body.prompt?.substring(0, 100) + '...',
        hasImages: !!(body.image_url || body.image_urls),
        timestamp: new Date().toISOString()
      });

      // 验证请求体
      if (!body.action || !body.prompt) {
        throw new Error('Missing required fields: action and prompt are required');
      }

      // 🔐 暂时移除用户身份验证，直接返回演示模式
      // const session = await getServerSession(authOptions);
      // if (!session?.user?.email) {
      //   return NextResponse.json(
      //     { 
      //       error: 'Sign in to start creating! Get 100 free credits instantly.',
      //       message: 'Sign in to start creating! Get 100 free credits instantly.'
      //     },
      //     { status: 401 }
      //   );
      // }

      // 🔍 暂时跳过用户信息获取
      // const user = await prisma.user.findUnique({
      //   where: { email: session.user.email }
      // });

      // if (!user) {
      //   return NextResponse.json(
      //     { error: 'User not found, please sign in again' },
      //     { status: 404 }
      //   );
      // }

      // 🛡️ 内容安全检查（可选 - 默认关闭）
      const enableContentSafety = process.env.NEXT_PUBLIC_ENABLE_CONTENT_SAFETY === "true";
      
      if (enableContentSafety) {
        console.log('🛡️ Starting content safety check...');
        
        try {
          // 检查提示词安全性
          const prompt = body.prompt;
          // 安全检查
          const promptSafetyResult = await contentSafety.checkPromptSafety(prompt)
          if (promptSafetyResult && !promptSafetyResult.isSafe) {
            return NextResponse.json({
              success: false,
              error: "Content safety check failed",
              reason: promptSafetyResult.categories.map(c => c.description).join(', ') || "Unsafe content detected"
            }, { status: 400 })
          }
          console.log('✅ Prompt safety check passed');
        } catch (error) {
          console.error('❌ Content safety check error:', error);
          // 安全检查失败时，可以选择继续或拒绝请求
          // 这里选择继续，但记录错误
        }
      }

      // 🎯 暂时跳过积分检查，直接进行图像生成
      // const requiredCredits = getRequiredCredits(body.action);
      // const hasEnoughCredits = await checkUserCredits(user.id, requiredCredits);
      
      // if (!hasEnoughCredits) {
      //   return NextResponse.json(
      //     { 
      //       error: 'Insufficient credits',
      //       message: 'You need more credits to generate this image. Please upgrade your plan.',
      //       requiredCredits,
      //       currentCredits: user.credits
      //     },
      //     { status: 402 }
      //   );
      // }

      // 🚀 开始图像生成
      console.log('🎨 Starting image generation with Flux Kontext...');
      
      const fluxKontext = new FluxKontextService();
      
      // 根据操作类型调用不同的方法
      let result;
      if (body.operation === 'generate') {
        result = await FluxKontextService.textToImagePro({
          prompt: body.prompt,
          aspect_ratio: body.aspect_ratio,
          seed: body.seed,
          guidance_scale: body.guidance_scale,
          num_images: body.num_images || 1,
          safety_tolerance: body.safety_tolerance,
          output_format: body.output_format
        });
      } else if (body.operation === 'variations') {
        result = await FluxKontextService.editImagePro({
          prompt: body.prompt,
          image_url: body.image_url,
          seed: body.seed,
          guidance_scale: body.guidance_scale,
          num_images: body.num_images || 1,
          safety_tolerance: body.safety_tolerance,
          output_format: body.output_format
        });
      } else if (body.operation === 'inpaint') {
        result = await FluxKontextService.editImagePro({
          prompt: body.prompt,
          image_url: body.image_url,
          seed: body.seed,
          guidance_scale: body.guidance_scale,
          num_images: body.num_images || 1,
          safety_tolerance: body.safety_tolerance,
          output_format: body.output_format
        });
      }

      // ✅ 生成成功
      console.log('✅ Image generation completed successfully');
      
      // 暂时跳过积分扣除
      // await consumeCreditsForImageGeneration(user.id, requiredCredits, body.action, body.prompt);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 返回结果
      return NextResponse.json({
        success: true,
        images: result?.images || [],
        timings: result?.timings,
        seed: result?.seed,
        has_nsfw_concepts: result?.has_nsfw_concepts,
        prompt: body.prompt
      });

    };

    // 使用Promise.race来设置超时
    const response = await Promise.race([mainLogic(), timeoutPromise]);
    return response;

  } catch (error) {
    console.error('❌ Image generation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Image generation failed',
        message: errorMessage
      },
      { status: 500 }
    );
  }
}

// 获取所需积分的函数
const getRequiredCredits = (action: string): number => {
  switch (action) {
    case 'generate':
      return 1;
    case 'variations':
      return 1;
    case 'inpaint':
      return 2;
    default:
      return 1;
  }
};

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 暂时移除用户验证
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.email) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // 处理图像编辑请求
    console.log('🎨 Processing image edit request...');
    
    const fluxKontext = new FluxKontextService();
    
    // 这里可以添加图像编辑逻辑
    // 暂时返回成功响应
    return NextResponse.json({
      success: true,
      message: 'Image edit functionality temporarily disabled'
    });

  } catch (error) {
    console.error('❌ Image edit error:', error);
    
    return NextResponse.json(
      { 
        error: 'Image edit failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 