'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShowrunnerLogo } from '@/components/logo'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error?.message ?? '登录失败'); return }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      {/* 背景 */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[320px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[360px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/"><ShowrunnerLogo size={30} /></Link>
        </div>

        {/* 卡片 */}
        <div className="glass-card rounded-2xl p-8"
          style={{ boxShadow: '0 16px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)' }}>

          <div className="mb-6">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>欢迎回来</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>登录你的 Showrunner 账号</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="input-dark w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-dark w-full rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5"
                  style={{ color: '#FCA5A5' }}>
                  <path fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd" />
                </svg>
                <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full rounded-lg py-2.5 text-sm font-semibold mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  登录中...
                </>
              ) : '登录'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          没有账号？{' '}
          <Link href="/sign-up"
            className="font-semibold transition-opacity hover:opacity-80"
            style={{ color: '#22C55E' }}>
            免费注册
          </Link>
        </p>
      </div>
    </div>
  )
}
