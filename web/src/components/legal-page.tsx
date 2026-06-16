import Link from 'next/link'
import type { ReactNode } from 'react'
import { ShowrunnerLogo } from '@/components/logo'

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <header
        className="sticky top-0 z-20"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="Showrunner home">
            <ShowrunnerLogo size={28} />
          </Link>
          <nav className="flex items-center gap-2.5">
            <Link href="/sign-in" className="btn-outline rounded-lg px-4 py-2 text-sm">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-brand rounded-lg px-4 py-2 text-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Last updated: {lastUpdated}
          </p>

          <div
            className="mt-8 space-y-6 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {children}
          </div>
        </article>
      </main>

      <footer
        className="py-6 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span>© 2026 Showrunner</span>
          <div className="flex items-center gap-5">
            <Link href="/terms-of-service" className="hover:underline">Terms</Link>
            <Link href="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link href="/refund-policy" className="hover:underline">Refund</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}
