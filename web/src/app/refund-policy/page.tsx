import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { getT } from '@/lib/i18n-server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()

  return {
    title: `${t.legal.refund.title} | Showrunner`,
    description: t.legal.refund.metaDescription,
  }
}

export default async function RefundPolicyPage() {
  const { t } = await getT()

  return (
    <LegalPage
      page={t.legal.refund}
      labels={{
        lastUpdatedLabel: t.legal.lastUpdatedLabel,
        lastUpdated: t.legal.lastUpdated,
        footer: t.legal.footer,
        links: t.legal.links,
        nav: {
          signIn: t.nav.signIn,
          signUp: t.nav.signUp,
        },
      }}
    />
  )
}
