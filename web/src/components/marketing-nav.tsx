import Link from 'next/link'
import { LangToggle } from '@/components/lang-toggle'
import { ShowrunnerIcon, ShowrunnerLogo } from '@/components/logo'

type MarketingNavLabels = {
  pricing: string
  signIn: string
  signUp: string
  goToDashboard: string
}

function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

export function MarketingNav({
  labels,
  loggedIn = false,
  activeHref,
}: {
  labels: MarketingNavLabels
  loggedIn?: boolean
  activeHref?: '/pricing'
}) {
  const pricingActive = activeHref === '/pricing'

  return (
    <header
      className="sticky top-0 z-20"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Showrunner home" className="flex shrink-0 items-center">
          <div className="hidden sm:block">
            <ShowrunnerLogo size={28} />
          </div>
          <span className="sm:hidden">
            <ShowrunnerIcon size={28} />
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors"
            style={{
              background: pricingActive ? '#EEF2FF' : 'transparent',
              color: pricingActive ? '#4338CA' : 'var(--text-secondary)',
            }}
          >
            {labels.pricing}
          </Link>
          <LangToggle />
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="btn-brand inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm"
            >
              {labels.goToDashboard}
              <IconArrow />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="btn-outline hidden min-h-11 items-center rounded-lg px-4 text-sm sm:inline-flex"
              >
                {labels.signIn}
              </Link>
              <Link
                href="/sign-up"
                className="btn-brand inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm"
              >
                {labels.signUp}
                <IconArrow />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
