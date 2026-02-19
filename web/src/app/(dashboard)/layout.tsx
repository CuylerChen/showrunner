'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShowrunnerLogo } from '@/components/logo'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-20"
        style={{
          background: 'rgba(7,11,20,0.85)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard">
            <ShowrunnerLogo size={28} />
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs font-medium rounded-lg px-3 py-1.5 transition-all"
            style={{
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.color = 'var(--text-secondary)'
              ;(e.target as HTMLElement).style.borderColor = 'var(--border-bright)'
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.color = 'var(--text-muted)'
              ;(e.target as HTMLElement).style.borderColor = 'var(--border)'
            }}
          >
            退出登录
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
