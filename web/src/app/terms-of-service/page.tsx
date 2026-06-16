import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { getT } from '@/lib/i18n-server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()

  return {
    title: `${t.legal.terms.title} | Showrunner`,
    description: t.legal.terms.metaDescription,
  }
}

export default async function TermsOfServicePage() {
  const { t } = await getT()

  return (
    <LegalPage
      page={t.legal.terms}
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
