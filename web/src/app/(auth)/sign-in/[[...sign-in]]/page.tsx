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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-surface)' }}>
      {/* 顶部导航 */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Link href="/"><ShowrunnerLogo size={26} /></Link>
        </div>
      </header>

      {/* 表单区域 */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              欢迎回来
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              登录你的 Showrunner 账号
            </p>
          </div>

          {/* 卡片 */}
          <div className="glass-card rounded-2xl p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>
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
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>
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
                <div className="flex items-start gap-2 rounded-lg px-3.5 py-2.5"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5"
                    style={{ color: '#DC2626' }}>
                    <path fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd" />
                  </svg>
                  <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-brand w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    登录中...
                  </>
                ) : '登录'}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            没有账号？{' '}
            <Link href="/sign-up" className="font-semibold hover:underline"
              style={{ color: '#16A34A' }}>
              免费注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
