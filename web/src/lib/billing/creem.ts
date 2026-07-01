import crypto from 'node:crypto'
import {
  getPlanLimit,
  isPaidPlan,
  type LocalSubscriptionStatus,
  type PaidPlan,
} from '@/lib/plans'

export type { AppPlan, LocalSubscriptionStatus, PaidPlan } from '@/lib/plans'

export interface CreemConfig {
  apiKey: string
  webhookSecret: string
  apiBaseUrl: string
  productIds: Record<PaidPlan, string>
}

export interface CreemCheckoutPayload {
  product_id: string
  units: number
  request_id?: string
  customer?: {
    email: string
  }
  success_url: string
  metadata: {
    app: 'showrunner'
    user_id: string
    plan: PaidPlan
  }
}

export interface CreemCustomerBillingPayload {
  customer_id: string
}

export interface CreemCustomerBillingLinks {
  portalUrl: string | null
}

export interface CreemPlanEventLike {
  metadata?: Record<string, unknown> | null
  product?: string | { id?: string | null } | null
  items?: Array<{
    product_id?: string | null
    product?: { id?: string | null } | string | null
  }> | null
}

export interface CreemStatusMapping {
  localStatus: LocalSubscriptionStatus
  resetToFree: boolean
}

type CreemCustomerBillingResponseLike = {
  customer_portal_link?: string | null
}

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? ''
}

function cleanUrl(value: string | undefined): string {
  return cleanEnv(value).replace(/\/+$/, '')
}

function productIdFromProduct(product: CreemPlanEventLike['product']): string | null {
  if (typeof product === 'string') return product || null
  if (product && typeof product.id === 'string' && product.id) return product.id
  return null
}

function safeCompareHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false

  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length) return false

  return crypto.timingSafeEqual(left, right)
}

export function resolveCreemConfig(env: Record<string, string | undefined> = process.env): CreemConfig {
  const apiKey = cleanEnv(env.CREEM_API_KEY)
  const configuredBaseUrl = cleanUrl(env.CREEM_API_BASE_URL)
  const apiBaseUrl = configuredBaseUrl
    || (apiKey.startsWith('creem_test_') ? 'https://test-api.creem.io' : 'https://api.creem.io')

  return {
    apiKey,
    webhookSecret: cleanEnv(env.CREEM_WEBHOOK_SECRET),
    apiBaseUrl,
    productIds: {
      starter: cleanEnv(env.CREEM_STARTER_PRODUCT_ID),
      pro: cleanEnv(env.CREEM_PRO_PRODUCT_ID),
    },
  }
}

export function getCreemProductIdForPlan(plan: PaidPlan, config: CreemConfig): string | null {
  return config.productIds[plan] || null
}

export function buildShowrunnerBillingReturnUrl(
  requestUrl: string,
  billing: 'success' | 'processing' = 'success',
  appUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const origin = cleanUrl(appUrl) || requestUrl
  const returnUrl = new URL('/dashboard', origin)
  returnUrl.searchParams.set('billing', billing)
  return returnUrl.toString()
}

export function buildCreemCheckoutPayload(input: {
  plan: PaidPlan
  productId: string
  user: { id: string; email?: string | null }
  successUrl: string
  requestId?: string
}): CreemCheckoutPayload {
  const email = cleanEnv(input.user.email ?? undefined)

  return {
    product_id: input.productId,
    units: 1,
    ...(input.requestId ? { request_id: input.requestId } : {}),
    ...(email ? { customer: { email } } : {}),
    success_url: input.successUrl,
    metadata: {
      app: 'showrunner',
      user_id: input.user.id,
      plan: input.plan,
    },
  }
}

export function buildCreemCustomerBillingPayload(customerId: string): CreemCustomerBillingPayload {
  return { customer_id: customerId }
}

export function resolveCreemCustomerBillingLinks(
  response: CreemCustomerBillingResponseLike,
): CreemCustomerBillingLinks {
  return {
    portalUrl: response.customer_portal_link ?? null,
  }
}

export function signCreemWebhookPayload(rawBody: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
}

export function verifyCreemWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret) return false

  const expected = signCreemWebhookPayload(rawBody, secret)
  return header
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .some(signature => safeCompareHex(signature, expected))
}

export function resolveCreemPlanFromEvent(
  event: CreemPlanEventLike,
  config: CreemConfig,
): PaidPlan | null {
  const app = event.metadata?.app
  if (typeof app === 'string' && app && app !== 'showrunner') return null

  const customPlan = event.metadata?.plan
  if (isPaidPlan(customPlan)) return customPlan

  const knownProductIds = new Map<string, PaidPlan>([
    [config.productIds.starter, 'starter'],
    [config.productIds.pro, 'pro'],
  ].filter(([productId]) => Boolean(productId)) as Array<[string, PaidPlan]>)

  const productId = productIdFromProduct(event.product)
  if (productId && knownProductIds.has(productId)) {
    return knownProductIds.get(productId) ?? null
  }

  for (const item of event.items ?? []) {
    const itemProductId = item.product_id ?? productIdFromProduct(item.product ?? null)
    if (itemProductId && knownProductIds.has(itemProductId)) {
      return knownProductIds.get(itemProductId) ?? null
    }
  }

  return null
}

export function isShowrunnerCreemEvent(event: CreemPlanEventLike, config: CreemConfig): boolean {
  const app = event.metadata?.app
  if (typeof app === 'string' && app) return app === 'showrunner'

  return resolveCreemPlanFromEvent(event, config) !== null
}

export function mapCreemSubscriptionStatus(
  status: string | null | undefined,
  eventType?: string | null,
): CreemStatusMapping | null {
  switch (eventType) {
    case 'subscription.canceled':
    case 'subscription.paused':
      return { localStatus: 'cancelled', resetToFree: true }
    case 'subscription.expired':
      return { localStatus: 'expired', resetToFree: true }
  }

  switch (status) {
    case 'active':
    case 'trialing':
    case 'scheduled_cancel':
      return { localStatus: 'active', resetToFree: false }
    case 'paused':
    case 'canceled':
    case 'cancelled':
      return { localStatus: 'cancelled', resetToFree: true }
    case 'past_due':
    case 'unpaid':
    case 'expired':
      return { localStatus: 'expired', resetToFree: true }
    default:
      return null
  }
}

export { getPlanLimit }
