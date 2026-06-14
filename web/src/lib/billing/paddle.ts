import crypto from 'node:crypto'

export type AppPlan = 'free' | 'starter' | 'pro'
export type PaidPlan = Exclude<AppPlan, 'free'>
export type PaddleEnvironment = 'sandbox' | 'production'

export interface PaddleConfig {
  environment: PaddleEnvironment
  apiKey: string
  webhookSecret: string
  apiBaseUrl: string
  priceIds: Record<PaidPlan, string>
}

export interface PaddleTransactionPayload {
  items: Array<{ price_id: string; quantity: number }>
  collection_mode: 'automatic'
  customer_email: string
  custom_data: {
    user_id: string
    plan: PaidPlan
  }
}

export interface PaddlePlanEventLike {
  custom_data?: Record<string, unknown> | null
  items?: Array<{
    price_id?: string | null
    price?: { id?: string | null } | null
  }> | null
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
      return 3
    case 'starter':
      return 10
    case 'pro':
      return -1
  }
}

export function resolvePaddleConfig(env: NodeJS.ProcessEnv = process.env): PaddleConfig {
  const environment = cleanEnv(env.PADDLE_ENVIRONMENT) === 'production' ? 'production' : 'sandbox'

  return {
    environment,
    apiKey: cleanEnv(env.PADDLE_API_KEY),
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

export function buildPaddleTransactionPayload(input: {
  plan: PaidPlan
  priceId: string
  user: { id: string; email: string }
}): PaddleTransactionPayload {
  return {
    items: [{ price_id: input.priceId, quantity: 1 }],
    collection_mode: 'automatic',
    customer_email: input.user.email,
    custom_data: {
      user_id: input.user.id,
      plan: input.plan,
    },
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
