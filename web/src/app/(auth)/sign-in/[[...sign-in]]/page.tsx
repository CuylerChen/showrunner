'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShowrunnerLogo } from '@/components/logo'

/* ── OAuth 错误映射 ─────────────────────────────────────────────── */
const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied:         '授权被取消，请重试',
  oauth_state_mismatch: '安全验证失败，请重试',
  oauth_token_failed:   'OAuth 令牌获取失败，请重试',
  oauth_profile_failed: '获取账号信息失败，请重试',
  oauth_no_email:       '无法获取邮箱地址，请确保已授权邮箱访问',
}

/* ── Google Logo ──────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" />
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  )
}

/* ── GitHub Logo ──────────────────────────────────────────────────── */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

/* ── 错误提示组件 ──────────────────────────────────────────────────── */
function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-3.5 py-2.5"
      style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5"
        style={{ color: '#DC2626' }}>
        <path fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd" />
      </svg>
      <p className="text-sm" style={{ color: '#B91C1C' }}>{message}</p>
    </div>
  )
}

export default function SignInPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const oauthError = OAUTH_ERRORS[searchParams.get('error') ?? ''] ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
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

          {/* OAuth 回调错误 */}
          {oauthError && (
            <div className="mb-4">
              <ErrorAlert message={oauthError} />
            </div>
          )}

          {/* 卡片 */}
          <div className="glass-card rounded-2xl p-7 space-y-4">

            {/* ── OAuth 按钮区 ── */}
            <a
              href="/api/auth/oauth/google"
              className="flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: 'white',
                border:     '1px solid #E2E8F0',
                color:      '#374151',
                boxShadow:  '0 1px 2px rgba(0,0,0,0.05)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <GoogleIcon />
              使用 Google 账号登录
            </a>

            <a
              href="/api/auth/oauth/github"
              className="flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: '#24292F',
                border:     '1px solid #24292F',
                color:      'white',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1B2027')}
              onMouseLeave={e => (e.currentTarget.style.background = '#24292F')}
            >
              <GitHubIcon />
              使用 GitHub 账号登录
            </a>

            {/* ── 分隔线 ── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>或使用邮箱登录</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* ── 邮箱密码表单 ── */}
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

              {error && <ErrorAlert message={error} />}

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
