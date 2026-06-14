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
type PortalAction = 'portal' | 'cancel'

function formatQuota(used: number, limit: number, unlimitedLabel: string) {
  if (limit === -1) return unlimitedLabel
  return `${used} / ${limit}`
}

export function UpgradePanel({ plan, status, demosUsed, demosLimit }: UpgradePanelProps) {
  const { t } = useTranslation()
  const copy = t.subscriptionPanel
  const [loadingPlan, setLoadingPlan] = useState<UpgradePlan | null>(null)
  const [loadingPortal, setLoadingPortal] = useState<PortalAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const upgradeOptions: Array<{
    plan: UpgradePlan
    label: string
    disabled: boolean
    variant: 'starter' | 'pro'
  }> = [
    {
      plan: 'starter',
      label: copy.starter,
      disabled: loadingPlan !== null || plan === 'starter' || plan === 'pro',
      variant: 'starter',
    },
    {
      plan: 'pro',
      label: copy.pro,
      disabled: loadingPlan !== null || plan === 'pro',
      variant: 'pro',
    },
  ]

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

  async function openPortal(action: PortalAction) {
    setError(null)
    setLoadingPortal(action)

    try {
      const res = await fetch('/api/subscription/portal', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message ?? copy.portalError)
        return
      }

      const targetUrl = action === 'cancel'
        ? data.data.cancel_url ?? data.data.portal_url
        : data.data.portal_url ?? data.data.cancel_url
      if (!targetUrl) {
        setError(copy.portalError)
        return
      }

      window.location.href = targetUrl
    } catch {
      setError(copy.portalError)
    } finally {
      setLoadingPortal(null)
    }
  }

  const usage = formatQuota(demosUsed, demosLimit, copy.unlimited)
  const canManageSubscription = plan !== 'free'

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

        <div className="grid w-full flex-shrink-0 grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          {canManageSubscription && (
            <>
              <button
                type="button"
                onClick={() => openPortal('portal')}
                disabled={loadingPortal !== null}
                className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                style={{ background: '#F8FAFC', color: '#0F172A', border: '1px solid #CBD5E1' }}
              >
                {loadingPortal === 'portal' ? copy.loading : copy.manageBilling}
              </button>
              <button
                type="button"
                onClick={() => openPortal('cancel')}
                disabled={loadingPortal !== null}
                className="min-h-10 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
              >
                {loadingPortal === 'cancel' ? copy.loading : copy.cancelBilling}
              </button>
            </>
          )}
          {upgradeOptions.map((option) => {
            const pricing = copy.upgradePlans[option.plan]
            const isPro = option.variant === 'pro'
            return (
              <button
                key={option.plan}
                type="button"
                onClick={() => startCheckout(option.plan)}
                disabled={option.disabled}
                className="min-h-24 min-w-36 rounded-xl px-4 py-3 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: isPro ? '#0F172A' : '#EEF2FF',
                  color: isPro ? 'white' : '#4338CA',
                  border: isPro ? '1px solid #0F172A' : '1px solid #C7D2FE',
                }}
              >
                <span className="block text-xs font-semibold">
                  {loadingPlan === option.plan ? copy.loading : option.label}
                </span>
                <span className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-bold tabular-nums">
                    {pricing.price}
                  </span>
                  <span className="text-[11px] font-medium opacity-80">
                    {pricing.period}
                  </span>
                </span>
                <span className="mt-1 block text-[11px] font-medium opacity-80">
                  {pricing.quota}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
