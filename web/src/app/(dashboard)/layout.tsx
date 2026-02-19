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
    <div className="min-h-screen" style={{ background: 'var(--bg-surface)' }}>
      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20"
        style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="cursor-pointer">
            <ShowrunnerLogo size={26} />
          </Link>
          <button
            onClick={handleLogout}
            className="btn-outline rounded-lg px-3.5 py-1.5 text-sm cursor-pointer"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* ── 主内容 ───────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
