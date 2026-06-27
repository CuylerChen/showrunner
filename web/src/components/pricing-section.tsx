import Link from 'next/link'
import type { zh } from '@/locales/zh'

type PricingCopy = Pick<
  typeof zh.home,
  'pricingTitle' | 'pricingSub' | 'pricingPlans' | 'pricingFeatured' | 'pricingCta'
>

function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M13 4L6 11 3 8" />
    </svg>
  )
}

export function PricingSection({
  copy,
  loggedIn,
  dashboardLabel,
  showTopBorder = true,
}: {
  copy: PricingCopy
  loggedIn: boolean
  dashboardLabel: string
  showTopBorder?: boolean
}) {
  return (
    <section
      className="px-4 py-20"
      style={{
        background: 'var(--bg-surface)',
        borderTop: showTopBorder ? '1px solid var(--border)' : undefined,
      }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
            {copy.pricingTitle}
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {copy.pricingSub}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {copy.pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className="glass-card relative flex min-h-[360px] flex-col rounded-xl p-6"
              style={plan.highlighted ? { borderColor: '#6366F1', boxShadow: '0 18px 50px rgba(99,102,241,0.14)' } : undefined}
            >
              {plan.highlighted && (
                <div
                  className="absolute right-5 top-5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}
                >
                  {copy.pricingFeatured}
                </div>
              )}

              <div className="pr-24">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {plan.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {plan.description}
                </p>
              </div>

              <div className="mt-6">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {plan.price}
                  </span>
                  <span className="pb-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {plan.period}
                  </span>
                </div>
                <div
                  className="mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: plan.highlighted ? '#EEF2FF' : 'var(--bg-base)',
                    color: plan.highlighted ? '#4338CA' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {plan.quota}
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: '#EEF2FF', color: '#4338CA' }}
                    >
                      <IconCheck />
                    </span>
                    <span className="leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={loggedIn ? '/dashboard' : '/sign-up'}
                className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${plan.highlighted ? 'btn-brand' : 'btn-outline'}`}
              >
                {loggedIn ? dashboardLabel : copy.pricingCta}
                <IconArrow />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
