import Link from 'next/link'
import { headers } from 'next/headers'
import { MarketingNav } from '@/components/marketing-nav'
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

      <MarketingNav
        loggedIn={loggedIn}
        labels={{
          pricing: t.nav.pricing,
          signIn: t.nav.signIn,
          signUp: t.nav.signUp,
          goToDashboard: t.nav.goToDashboard,
        }}
      />

      {/* ── Hero ─────────────────────────────────────────── */}
      <main className="flex-1">

        {/* Hero 区域 */}
        <section className="relative overflow-hidden px-4 py-16 sm:py-20"
          style={{ background: 'var(--bg-base)' }}>
          <div className="absolute inset-0 bg-grid pointer-events-none" />

          <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
                style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse-dot" />
                {h.badge}
              </div>

              <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl"
                style={{ color: 'var(--text-primary)' }}>
                {h.headline1}
                <br />
                <span className="animate-shimmer">{h.headline2}</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
                style={{ color: 'var(--text-secondary)' }}>
                {h.sub}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {loggedIn ? (
                  <Link href="/dashboard"
                    className="btn-brand inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold">
                    {t.nav.goToDashboard}
                    <IconArrow />
                  </Link>
                ) : (
                  <Link href="/sign-up"
                    className="btn-brand inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold">
                    {h.ctaStart}
                    <IconArrow />
                  </Link>
                )}
                <Link href="/pricing" className="btn-outline inline-flex items-center justify-center rounded-lg px-6 py-3.5 text-sm font-medium">
                  {h.ctaSecondary}
                </Link>
              </div>
              {!loggedIn && (
                <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {h.ctaNote}
                </p>
              )}
            </div>

            <div className="glass-card rounded-lg p-5">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {h.reviewChecklistTitle}
              </h2>
              <dl className="mt-4 space-y-4">
                {h.reviewChecklist.map((item) => (
                  <div key={item.label} className="grid gap-1 sm:grid-cols-[96px_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                      {item.label}
                    </dt>
                    <dd className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
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

        {/* ── 样例输出 ─────────────────────────────────── */}
        <section className="py-18 px-4" style={{ background: 'var(--bg-base)' }}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
                {h.demoTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {h.demoSub}
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="glass-card rounded-lg p-5">
                <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                  {h.exampleInputLabel}
                </div>
                <ul className="mt-4 space-y-3">
                  {h.exampleInput.map((line) => (
                    <li key={line} className="rounded-lg px-3 py-2 text-sm leading-relaxed"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-card rounded-lg p-5">
                <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                  {h.exampleOutputLabel}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {h.exampleOutput.map((item) => (
                    <div key={item.label} className="rounded-lg border p-4"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
                      <div className="text-xs font-semibold" style={{ color: '#4338CA' }}>
                        {item.label}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                  <div key={title} className="glass-card rounded-lg p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
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

        {/* ── 定价提示 ─────────────────────────────────── */}
        <section className="px-4 py-14"
          style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {h.pricingReviewTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {h.pricingReviewSub}
              </p>
            </div>
            <Link href="/pricing" className="btn-outline inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold">
              {h.pricingReviewCta}
            </Link>
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
              className="btn-brand inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-sm font-semibold">
              {t.nav.goToDashboard}
              <IconArrow />
            </Link>
          ) : (
            <Link href="/sign-up"
              className="btn-brand inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-sm font-semibold">
              {h.ctaBtn}
              <IconArrow />
            </Link>
          )}
        </section>
      </main>

      {/* ── 页脚 ─────────────────────────────────────────── */}
      <footer className="py-5 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span>{h.footer}</span>
          <div className="flex items-center gap-5">
            <Link href="/terms-of-service" className="hover:underline">{t.legal.links.terms}</Link>
            <Link href="/privacy-policy" className="hover:underline">{t.legal.links.privacy}</Link>
            <Link href="/refund-policy" className="hover:underline">{t.legal.links.refund}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
