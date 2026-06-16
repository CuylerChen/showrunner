import crypto from 'node:crypto'

export type AppPlan = 'free' | 'starter' | 'pro'
export type PaidPlan = Exclude<AppPlan, 'free'>
export type PaddleEnvironment = 'sandbox' | 'production'
export type LocalSubscriptionStatus = 'active' | 'cancelled' | 'expired'

export interface PaddleConfig {
  environment: PaddleEnvironment
  apiKey: string
  clientToken: string
  webhookSecret: string
  apiBaseUrl: string
  priceIds: Record<PaidPlan, string>
}

export interface PaddleTransactionPayload {
  items: Array<{ price_id: string; quantity: number }>
  collection_mode: 'automatic'
  custom_data: {
    app: 'showrunner'
    user_id: string
    plan: PaidPlan
  }
}

export interface PaddlePortalSessionPayload {
  subscription_ids?: string[]
}

export interface PaddlePortalLinks {
  portalUrl: string | null
  cancelUrl: string | null
  updatePaymentMethodUrl: string | null
}

export interface PaddlePlanEventLike {
  custom_data?: Record<string, unknown> | null
  items?: Array<{
    price_id?: string | null
    price?: { id?: string | null } | null
  }> | null
}

type PaddlePortalSessionResponseLike = {
  data?: {
    urls?: {
      general?: {
        overview?: string | null
      } | null
      subscriptions?: Array<{
        id?: string | null
        cancel_subscription?: string | null
        update_subscription_payment_method?: string | null
      }> | null
    } | null
  } | null
}

export interface PaddleStatusMapping {
  localStatus: LocalSubscriptionStatus
  resetToFree: boolean
}

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'starter' || value === 'pro'
}

export function getPlanLimit(plan: AppPlan): number {
  switch (plan) {
    case 'free':
      return 1
    case 'starter':
      return 10
    case 'pro':
      return -1
  }
}

export function resolvePaddleConfig(env: Record<string, string | undefined> = process.env): PaddleConfig {
  const rawEnvironment = cleanEnv(env.PADDLE_ENVIRONMENT)
  const environment = rawEnvironment === 'production' || rawEnvironment === 'live' ? 'production' : 'sandbox'

  return {
    environment,
    apiKey: cleanEnv(env.PADDLE_API_KEY),
    clientToken: cleanEnv(env.PADDLE_CLIENT_TOKEN ?? env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
    webhookSecret: cleanEnv(env.PADDLE_WEBHOOK_SECRET),
    apiBaseUrl: environment === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com',
    priceIds: {
      starter: cleanEnv(env.PADDLE_STARTER_PRICE_ID),
      pro: cleanEnv(env.PADDLE_PRO_PRICE_ID),
    },
  }
}

export function getPaddlePriceIdForPlan(plan: PaidPlan, config: PaddleConfig): string | null {
  return config.priceIds[plan] || null
}

export function buildPaddleTransactionPayload(input: {
  plan: PaidPlan
  priceId: string
  user: { id: string }
}): PaddleTransactionPayload {
  return {
    items: [{ price_id: input.priceId, quantity: 1 }],
    collection_mode: 'automatic',
    custom_data: {
      app: 'showrunner',
      user_id: input.user.id,
      plan: input.plan,
    },
  }
}

export function buildShowrunnerCheckoutUrl(
  requestUrl: string,
  transactionId: string,
  appUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const checkoutUrl = new URL('/paddle-checkout', cleanEnv(appUrl) || requestUrl)
  checkoutUrl.searchParams.set('_ptxn', transactionId)
  return checkoutUrl.toString()
}

export function buildPaddlePortalSessionPayload(subscriptionId: string | null | undefined): PaddlePortalSessionPayload {
  return subscriptionId ? { subscription_ids: [subscriptionId] } : {}
}

export function resolvePaddlePortalLinks(
  response: PaddlePortalSessionResponseLike,
  subscriptionId: string | null | undefined,
): PaddlePortalLinks {
  const urls = response.data?.urls
  const subscriptionUrls = urls?.subscriptions?.find(item => item.id === subscriptionId)
    ?? urls?.subscriptions?.[0]
    ?? null

  return {
    portalUrl: urls?.general?.overview ?? null,
    cancelUrl: subscriptionUrls?.cancel_subscription ?? null,
    updatePaymentMethodUrl: subscriptionUrls?.update_subscription_payment_method ?? null,
  }
}

export function signPaddleWebhookPayload(rawBody: string, timestamp: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}:${rawBody}`)
    .digest('hex')
}

function parsePaddleSignature(header: string): { timestamp: number; signatures: string[] } | null {
  const parts = header.split(';').map(part => part.trim()).filter(Boolean)
  const timestampPart = parts.find(part => part.startsWith('ts='))
  const signatures = parts
    .filter(part => part.startsWith('h1='))
    .map(part => part.slice(3))
    .filter(Boolean)
  const timestamp = Number(timestampPart?.slice(3))

  if (!Number.isFinite(timestamp) || signatures.length === 0) return null
  return { timestamp, signatures }
}

function safeCompareHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false

  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length) return false

  return crypto.timingSafeEqual(left, right)
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  options: { nowMs?: number; toleranceMs?: number } = {},
): boolean {
  if (!header || !secret) return false

  const parsed = parsePaddleSignature(header)
  if (!parsed) return false

  const toleranceMs = options.toleranceMs ?? 5 * 60 * 1000
  const nowMs = options.nowMs ?? Date.now()
  if (Math.abs(nowMs - parsed.timestamp * 1000) > toleranceMs) return false

  const expected = signPaddleWebhookPayload(rawBody, parsed.timestamp, secret)
  return parsed.signatures.some(signature => safeCompareHex(signature, expected))
}

export function resolvePaddlePlanFromEvent(
  event: PaddlePlanEventLike,
  config: PaddleConfig,
): PaidPlan | null {
  const app = event.custom_data?.app
  if (typeof app === 'string' && app && app !== 'showrunner') return null

  const customPlan = event.custom_data?.plan
  if (isPaidPlan(customPlan)) return customPlan

  const knownPriceIds = new Map<string, PaidPlan>([
    [config.priceIds.starter, 'starter'],
    [config.priceIds.pro, 'pro'],
  ].filter(([priceId]) => Boolean(priceId)) as Array<[string, PaidPlan]>)

  for (const item of event.items ?? []) {
    const priceId = item.price?.id ?? item.price_id ?? null
    if (priceId && knownPriceIds.has(priceId)) {
      return knownPriceIds.get(priceId) ?? null
    }
  }

  return null
}

export function isShowrunnerPaddleEvent(event: PaddlePlanEventLike, config: PaddleConfig): boolean {
  const app = event.custom_data?.app
  if (typeof app === 'string' && app) return app === 'showrunner'

  return resolvePaddlePlanFromEvent(event, config) !== null
}

export function mapPaddleSubscriptionStatus(status: string | null | undefined): PaddleStatusMapping | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return { localStatus: 'active', resetToFree: false }
    case 'paused':
    case 'canceled':
    case 'cancelled':
      return { localStatus: 'cancelled', resetToFree: true }
    case 'past_due':
      return { localStatus: 'expired', resetToFree: true }
    default:
      return null
  }
}
