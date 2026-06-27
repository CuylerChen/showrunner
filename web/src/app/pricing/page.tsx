import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { MarketingNav } from '@/components/marketing-nav'
import { PricingSection } from '@/components/pricing-section'
import { getT } from '@/lib/i18n-server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()

  return {
    title: `${t.home.pricingTitle} | Showrunner`,
    description: t.home.pricingSub,
  }
}

export default async function PricingPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const loggedIn = !!userId

  const { t } = await getT()

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg-surface)' }}>
      <MarketingNav
        loggedIn={loggedIn}
        activeHref="/pricing"
        labels={{
          pricing: t.nav.pricing,
          signIn: t.nav.signIn,
          signUp: t.nav.signUp,
          goToDashboard: t.nav.goToDashboard,
        }}
      />

      <main className="flex-1">
        <PricingSection
          copy={t.home}
          loggedIn={loggedIn}
          dashboardLabel={t.nav.goToDashboard}
          showTopBorder={false}
        />
      </main>

      <footer
        className="py-5 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span>{t.home.footer}</span>
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
