'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import type { PlanType, SubStatus } from '@/types'

interface UpgradePanelProps {
  plan: PlanType
  status: SubStatus
  demosUsed: number
  demosLimit: number
}

type UpgradePlan = 'starter' | 'pro'

function formatQuota(used: number, limit: number, unlimitedLabel: string) {
  if (limit === -1) return unlimitedLabel
  return `${used} / ${limit}`
}

export function UpgradePanel({ plan, status, demosUsed, demosLimit }: UpgradePanelProps) {
  const { t } = useTranslation()
  const copy = t.subscriptionPanel
  const [loadingPlan, setLoadingPlan] = useState<UpgradePlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout(nextPlan: UpgradePlan) {
    setError(null)
    setLoadingPlan(nextPlan)

    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message ?? copy.error)
        return
      }
      window.location.href = data.data.checkout_url
    } catch {
      setError(copy.error)
    } finally {
      setLoadingPlan(null)
    }
  }

  const usage = formatQuota(demosUsed, demosLimit, copy.unlimited)

  return (
    <section
      className="rounded-2xl px-5 py-4"
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
            {copy.label}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
              {copy.planName[plan]}
            </span>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: '#EEF2FF', color: '#4338CA' }}>
              {usage}
            </span>
            {status !== 'active' && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
                {copy.statusName[status]}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: '#64748B' }}>
            {copy.description}
          </p>
          {error && (
            <p className="mt-2 text-xs" style={{ color: '#DC2626' }}>{error}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => startCheckout('starter')}
            disabled={loadingPlan !== null || plan === 'starter' || plan === 'pro'}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}
          >
            {loadingPlan === 'starter' ? copy.loading : copy.starter}
          </button>
          <button
            type="button"
            onClick={() => startCheckout('pro')}
            disabled={loadingPlan !== null || plan === 'pro'}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: '#0F172A', color: 'white', border: '1px solid #0F172A' }}
          >
            {loadingPlan === 'pro' ? copy.loading : copy.pro}
          </button>
        </div>
      </div>
    </section>
  )
}
