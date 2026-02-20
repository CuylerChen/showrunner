import Link from 'next/link'
import { headers } from 'next/headers'
import { ShowrunnerLogo } from '@/components/logo'
import { LangToggle } from '@/components/lang-toggle'
import { getT } from '@/lib/i18n-server'

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.899L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}
function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}
function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

const FEATURE_ICONS = [IconBolt, IconVideo, IconLink]
const FEATURE_COLORS = [
  { color: '#6366F1', bg: '#EEF2FF' },
  { color: '#16A34A', bg: '#F0FDF4' },
  { color: '#0891B2', bg: '#ECFEFF' },
]

export default async function HomePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const loggedIn = !!userId

  const { t } = await getT()
  const h = t.home

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* ── 顶部导航 ─────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}
        className="sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <ShowrunnerLogo size={28} />
          <nav className="flex items-center gap-2.5">
            <LangToggle />
            {loggedIn ? (
              <Link href="/dashboard"
                className="btn-brand rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1.5">
                {t.nav.goToDashboard}
                <IconArrow />
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="btn-outline rounded-lg px-4 py-2 text-sm">
                  {t.nav.signIn}
                </Link>
                <Link href="/sign-up"
                  className="btn-brand rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1.5">
                  {t.nav.signUp}
                  <IconArrow />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <main className="flex-1">

        {/* Hero 区域 */}
        <section className="relative overflow-hidden py-24 text-center px-4"
          style={{ background: 'var(--bg-base)' }}>
          {/* 背景网格 */}
          <div className="absolute inset-0 bg-grid pointer-events-none" />
          {/* 顶部光晕 */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

          <div className="relative max-w-3xl mx-auto">
            {/* 标签 */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
              style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse-dot" />
              {h.badge}
            </div>

            {/* 主标题 */}
            <h1 className="text-5xl font-bold leading-[1.1] sm:text-6xl lg:text-[4.25rem]"
              style={{ color: 'var(--text-primary)' }}>
              {h.headline1}
              <br />
              <span className="animate-shimmer">{h.headline2}</span>
            </h1>

            {/* 副标题 */}
            <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
              style={{ color: 'var(--text-secondary)' }}>
              {h.sub.split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br className="hidden sm:block" />}</span>
              ))}
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              {loggedIn ? (
                <Link href="/dashboard"
                  className="btn-brand rounded-xl px-8 py-3.5 text-sm font-semibold inline-flex items-center gap-2">
                  {t.nav.goToDashboard}
                  <IconArrow />
                </Link>
              ) : (
                <>
                  <Link href="/sign-up"
                    className="btn-brand rounded-xl px-8 py-3.5 text-sm font-semibold inline-flex items-center gap-2">
                    {h.ctaStart}
                    <IconArrow />
                  </Link>
                  <Link href="/sign-in" className="btn-outline rounded-xl px-8 py-3.5 text-sm font-medium">
                    {h.ctaSignIn}
                  </Link>
                </>
              )}
            </div>
            {!loggedIn && (
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {h.ctaNote}
              </p>
            )}
          </div>
        </section>

        {/* ── 统计数字 ──────────────────────────────────── */}
        <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div className="max-w-3xl mx-auto px-4 py-8 grid grid-cols-3 gap-4 text-center">
            {h.stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
                  {s.value}
                </div>
                <div className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 特性卡片 ─────────────────────────────────── */}
        <section className="py-20 px-4" style={{ background: 'var(--bg-base)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
                {h.featuresTitle}
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {h.featuresSub}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {h.features.map(({ title, desc }, i) => {
                const Icon = FEATURE_ICONS[i]
                const { color, bg } = FEATURE_COLORS[i]
                return (
                  <div key={title} className="glass-card rounded-2xl p-6">
                    <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-xl"
                      style={{ background: bg, color }}>
                      <Icon />
                    </div>
                    <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      0{i + 1}
                    </div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── 底部 CTA ─────────────────────────────────── */}
        <section className="py-16 px-4 text-center"
          style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            {h.ctaTitle}
          </h2>
          <p className="mt-2 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {h.ctaSub}
          </p>
          {loggedIn ? (
            <Link href="/dashboard"
              className="btn-brand inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold">
              {t.nav.goToDashboard}
              <IconArrow />
            </Link>
          ) : (
            <Link href="/sign-up"
              className="btn-brand inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold">
              {h.ctaBtn}
              <IconArrow />
            </Link>
          )}
        </section>
      </main>

      {/* ── 页脚 ─────────────────────────────────────────── */}
      <footer className="flex items-center justify-center py-5 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {h.footer}
      </footer>
    </div>
  )
}
