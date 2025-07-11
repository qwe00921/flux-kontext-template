"use client"

import { useState, useEffect } from "react"
// import { signIn, getProviders } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
// 导入认证文案模块
import { auth, common } from "@/lib/content"

// 已移除 getProviders、signIn 相关逻辑，直接展示静态登录提示
export function SignInContent() {
  return (
    <div>
      <h2>Sign In</h2>
      <p>Demo mode: sign in is disabled.</p>
    </div>
  )
} 