import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { getT } from '@/lib/i18n-server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()

  return {
    title: `${t.legal.privacy.title} | Showrunner`,
    description: t.legal.privacy.metaDescription,
  }
}

export default async function PrivacyPolicyPage() {
  const { t } = await getT()

  return (
    <LegalPage
      page={t.legal.privacy}
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
