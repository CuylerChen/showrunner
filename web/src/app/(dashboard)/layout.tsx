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
      {/* ── 顶部导航栏 ───────────────────────────────────── */}
      <header className="sticky top-0 z-20"
        style={{
          background: 'rgba(5,9,17,0.88)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="cursor-pointer">
            <ShowrunnerLogo size={26} />
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="btn-outline rounded-lg px-3.5 py-1.5 text-xs cursor-pointer"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* ── 主内容 ───────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
