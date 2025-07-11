"use client"

import { useState } from "react"
// import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from '@supabase/supabase-js'

// 已移除 signIn 相关逻辑，直接展示静态注册提示
export function SignUpContent() {
  return (
    <div>
      <h2>Sign Up</h2>
      <p>Demo mode: sign up is disabled.</p>
    </div>
  )
} 