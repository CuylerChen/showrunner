'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ShowrunnerLogo } from '@/components/logo'
import { LangToggle } from '@/components/lang-toggle'
import { useTranslation } from '@/lib/i18n'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { t }    = useTranslation()
  const d        = t.dashboard

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/sign-in')
    router.refresh()
  }

  const tabs = [
    { label: d.navCreate,   href: '/dashboard' },
    { label: d.navMyTours,  href: '/dashboard/tours' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-surface)' }}>
      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20"
        style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {/* Logo + Tab 导航 */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="cursor-pointer flex-shrink-0">
              <ShowrunnerLogo size={26} />
            </Link>

            <nav className="flex items-center gap-1">
              {tabs.map(tab => {
                const isActive = tab.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(tab.href)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: isActive ? '#EEF2FF' : 'transparent',
                      color: isActive ? '#4338CA' : 'var(--text-muted)',
                    }}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* 右侧操作 */}
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              onClick={handleLogout}
              className="btn-outline rounded-lg px-3.5 py-1.5 text-sm cursor-pointer"
            >
              {t.nav.logout}
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
