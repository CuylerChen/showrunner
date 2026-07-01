import Link from 'next/link'
import type { ReactNode } from 'react'
import { LangToggle } from '@/components/lang-toggle'
import { ShowrunnerLogo } from '@/components/logo'

type LegalContent = {
  title: string
  intro: string[]
  sections: Array<{
    title: string
    paragraphs: string[]
    items?: string[]
  }>
}

type LegalLabels = {
  lastUpdatedLabel: string
  lastUpdated: string
  footer: string
  links: {
    terms: string
    privacy: string
    refund: string
  }
  nav: {
    signIn: string
    signUp: string
  }
}

function linkedText(text: string): ReactNode[] {
  const linkPattern = /(https:\/\/www\.creem\.io\/terms|support@cuylerchen\.uk|support@creem\.io)/g

  return text.split(linkPattern).map((part, index) => {
    if (part === 'https://www.creem.io/terms') {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          className="font-medium hover:underline"
          style={{ color: '#16A34A' }}
        >
          {part}
        </a>
      )
    }

    if (part === 'support@cuylerchen.uk' || part === 'support@creem.io') {
      return (
        <a
          key={`${part}-${index}`}
          href={`mailto:${part}`}
          className="font-medium hover:underline"
          style={{ color: '#16A34A' }}
        >
          {part}
        </a>
      )
    }

    return part
  })
}

export function LegalPage({
  page,
  labels,
}: {
  page: LegalContent
  labels: LegalLabels
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
            <LangToggle />
            <Link href="/sign-in" className="btn-outline rounded-lg px-4 py-2 text-sm">
              {labels.nav.signIn}
            </Link>
            <Link href="/sign-up" className="btn-brand rounded-lg px-4 py-2 text-sm">
              {labels.nav.signUp}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
            {page.title}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {labels.lastUpdatedLabel}: {labels.lastUpdated}
          </p>

          <div
            className="mt-8 space-y-6 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {page.intro.map((paragraph) => (
              <p key={paragraph}>{linkedText(paragraph)}</p>
            ))}

            {page.sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{linkedText(paragraph)}</p>
                ))}
                {section.items && (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{linkedText(item)}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>

      <footer
        className="py-6 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span>{labels.footer}</span>
          <div className="flex items-center gap-5">
            <Link href="/terms-of-service" className="hover:underline">{labels.links.terms}</Link>
            <Link href="/privacy-policy" className="hover:underline">{labels.links.privacy}</Link>
            <Link href="/refund-policy" className="hover:underline">{labels.links.refund}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
