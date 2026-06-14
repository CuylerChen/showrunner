import { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { err, ok } from '@/lib/api'
import {
  getPlanLimit,
  mapPaddleSubscriptionStatus,
  resolvePaddleConfig,
  resolvePaddlePlanFromEvent,
  verifyPaddleWebhookSignature,
  type AppPlan,
  type LocalSubscriptionStatus,
} from '@/lib/billing/paddle'

type PaddleEvent = {
  event_id?: string
  event_type?: string
  occurred_at?: string
  data?: PaddleSubscriptionData
}

type PaddleSubscriptionData = {
  id?: string
  status?: string
  customer_id?: string | null
  custom_data?: Record<string, unknown> | null
  items?: Array<{
    price_id?: string | null
    price?: { id?: string | null } | null
  }> | null
  current_billing_period?: {
    ends_at?: string | null
  } | null
}

type DuplicateEntryError = {
  code?: string
  errno?: number
  cause?: unknown
}

type EventInsertDatabase = {
  insert: typeof db.insert
}

function isDuplicateEntryError(error: unknown): boolean {
  const current = error as DuplicateEntryError | undefined
  if (!current) return false
  if (current.code === 'ER_DUP_ENTRY' || current.errno === 1062) return true
  return isDuplicateEntryError(current.cause)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function firstKnownPriceId(data: PaddleSubscriptionData): string | null {
  for (const item of data.items ?? []) {
    const priceId = item.price?.id ?? item.price_id ?? null
    if (priceId) return priceId
  }
  return null
}

function parsePaddleEvent(rawBody: string): PaddleEvent | null {
  try {
    return JSON.parse(rawBody) as PaddleEvent
  } catch {
    return null
  }
}

function isSubscriptionEvent(event: PaddleEvent): boolean {
  return typeof event.event_type === 'string' && event.event_type.startsWith('subscription.')
}

async function insertEventOnce(
  database: EventInsertDatabase,
  event: PaddleEvent,
): Promise<'inserted' | 'duplicate'> {
  try {
    await database.insert(schema.paddleEvents).values({
      id: event.event_id!,
      event_type: event.event_type ?? 'unknown',
      occurred_at: parseDate(event.occurred_at),
    })
    return 'inserted'
  } catch (error) {
    if (isDuplicateEntryError(error)) return 'duplicate'
    throw error
  }
}

async function resolveTargetUserId(data: PaddleSubscriptionData): Promise<string | null> {
  const userIdFromCustomData = asString(data.custom_data?.user_id)
  if (userIdFromCustomData) return userIdFromCustomData

  const subscriptionId = asString(data.id)
  if (!subscriptionId) return null

  const existing = await db
    .select({ user_id: schema.subscriptions.user_id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.paddle_subscription_id, subscriptionId))
    .then(rows => rows[0] ?? null)

  return existing?.user_id ?? null
}

function buildSubscriptionUpdate(input: {
  data: PaddleSubscriptionData
  plan: AppPlan | null
  localStatus: LocalSubscriptionStatus | null
  resetToFree: boolean
}) {
  const paddleStatus = asString(input.data.status)
  const paddlePriceId = firstKnownPriceId(input.data)
  const currentPeriodEnd = parseDate(input.data.current_billing_period?.ends_at ?? null)

  const update: Record<string, unknown> = {
    paddle_customer_id: asString(input.data.customer_id),
    paddle_subscription_id: asString(input.data.id),
    paddle_price_id: paddlePriceId,
    paddle_status: paddleStatus,
    paddle_updated_at: new Date(),
  }

  if (currentPeriodEnd) update.current_period_end = currentPeriodEnd

  if (input.localStatus) update.status = input.localStatus

  if (input.resetToFree) {
    update.plan = 'free'
    update.demos_limit = getPlanLimit('free')
    return update
  }

  if (input.localStatus === 'active' && input.plan && input.plan !== 'free') {
    update.plan = input.plan
    update.demos_limit = getPlanLimit(input.plan)
  }

  return update
}

// POST /api/webhooks/paddle — Paddle Billing webhook receiver
export async function POST(req: NextRequest) {
  const config = resolvePaddleConfig()
  if (!config.webhookSecret) {
    return err('INTERNAL_ERROR', 'Paddle webhook secret is not configured')
  }

  const rawBody = await req.text()
  const signature = req.headers.get('Paddle-Signature')
  if (!verifyPaddleWebhookSignature(rawBody, signature, config.webhookSecret)) {
    return err('UNAUTHORIZED', 'Invalid Paddle signature')
  }

  const event = parsePaddleEvent(rawBody)
  if (!event || !event.event_id || !event.data) {
    return err('VALIDATION_ERROR', 'Invalid Paddle webhook payload')
  }

  if (!isSubscriptionEvent(event)) {
    const eventInsert = await insertEventOnce(db, event)
    if (eventInsert === 'duplicate') {
      return ok({ duplicate: true })
    }

    return ok({ ignored: true })
  }

  const data = event.data
  const userId = await resolveTargetUserId(data)
  if (!userId) {
    console.warn(`[paddle] webhook ignored, subscription owner not found event=${event.event_id}`)
    return ok({ ignored: true })
  }

  const paidPlan = resolvePaddlePlanFromEvent(data, config)
  const statusMapping = mapPaddleSubscriptionStatus(data.status)
  const update = buildSubscriptionUpdate({
    data,
    plan: paidPlan,
    localStatus: statusMapping?.localStatus ?? null,
    resetToFree: statusMapping?.resetToFree ?? false,
  })

  const result = await db.transaction(async tx => {
    const eventInsert = await insertEventOnce(tx, event)
    if (eventInsert === 'duplicate') return 'duplicate' as const

    await tx.update(schema.subscriptions)
      .set(update)
      .where(and(eq(schema.subscriptions.user_id, userId)))

    return 'processed' as const
  })

  if (result === 'duplicate') {
    return ok({ duplicate: true })
  }

  return ok({ processed: true })
}
