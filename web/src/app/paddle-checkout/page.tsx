import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ShowrunnerLogo } from '@/components/logo'
import { PaddleCheckoutClient } from '@/components/subscription/paddle-checkout-client'
import { getT } from '@/lib/i18n-server'
import { resolvePaddleConfig } from '@/lib/billing/paddle'

export const metadata: Metadata = {
  title: 'Paddle Checkout | Showrunner',
  description: 'Complete your Showrunner subscription checkout securely with Paddle.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function dashboardUrl(origin: string, billing: 'success' | 'processing'): string {
  const url = new URL('/dashboard', origin)
  url.searchParams.set('billing', billing)
  return url.toString()
}

async function requestOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  }

  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'showrunner.cuylerchen.uk'
  const proto = headerList.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export default async function PaddleCheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const { locale, t } = await getT()
  const params = await searchParams
  const transactionId = firstParam(params._ptxn) || firstParam(params.ptxn)
  const origin = await requestOrigin()
  const config = resolvePaddleConfig()

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
          <Link href="/dashboard" className="btn-outline rounded-lg px-4 py-2 text-sm">
            {t.nav.goToDashboard}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <section className="glass-card w-full max-w-md rounded-xl p-6 text-center">
          <div
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: '#EEF2FF', color: '#4338CA' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18" />
              <path d="M7 15h4" />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Paddle Checkout
          </h1>
          <PaddleCheckoutClient
            transactionId={transactionId}
            clientToken={config.clientToken}
            environment={config.environment}
            successUrl={dashboardUrl(origin, 'success')}
            processingUrl={dashboardUrl(origin, 'processing')}
            locale={locale}
          />
        </section>
      </main>
    </div>
  )
}
