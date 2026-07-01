import { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { err, ok } from '@/lib/api'
import {
  getPlanLimit,
  isShowrunnerCreemEvent,
  mapCreemSubscriptionStatus,
  resolveCreemConfig,
  resolveCreemPlanFromEvent,
  verifyCreemWebhookSignature,
  type AppPlan,
  type CreemPlanEventLike,
  type LocalSubscriptionStatus,
} from '@/lib/billing/creem'

type CreemReference = string | CreemEntity | null

type CreemEntity = {
  id?: string
  object?: string
  status?: string | null
  customer?: CreemReference
  product?: CreemReference
  subscription?: CreemReference
  metadata?: Record<string, unknown> | null
  items?: Array<{
    product_id?: string | null
    product?: CreemReference
  }> | null
  current_period_end_date?: string | null
}

type CreemEvent = {
  id?: string
  eventType?: string
  created_at?: string | number | null
  object?: CreemEntity | null
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function entityId(value: CreemReference | undefined): string | null {
  if (typeof value === 'string') return asString(value)
  if (value && typeof value === 'object') return asString(value.id)
  return null
}

function entityObject(value: CreemReference | undefined): CreemEntity | null {
  return value && typeof value === 'object' ? value : null
}

function parseCreemEvent(rawBody: string): CreemEvent | null {
  try {
    return JSON.parse(rawBody) as CreemEvent
  } catch {
    return null
  }
}

function isSubscriptionEvent(event: CreemEvent): boolean {
  return event.eventType === 'checkout.completed'
    || (typeof event.eventType === 'string' && event.eventType.startsWith('subscription.'))
}

function subscriptionFromEvent(event: CreemEvent): CreemEntity | null {
  const object = event.object
  if (!object) return null
  if (object.object === 'subscription') return object

  const subscription = entityObject(object.subscription)
  return subscription?.object === 'subscription' ? subscription : subscription
}

function metadataFromEvent(event: CreemEvent): Record<string, unknown> | null {
  const objectMetadata = asRecord(event.object?.metadata)
  const subscriptionMetadata = asRecord(subscriptionFromEvent(event)?.metadata)
  const metadata = {
    ...(objectMetadata ?? {}),
    ...(subscriptionMetadata ?? {}),
  }
  return Object.keys(metadata).length ? metadata : null
}

function productIdFromEvent(event: CreemEvent): string | null {
  const subscription = subscriptionFromEvent(event)
  const directProductId = entityId(subscription?.product) ?? entityId(event.object?.product)
  if (directProductId) return directProductId

  for (const item of subscription?.items ?? event.object?.items ?? []) {
    const itemProductId = asString(item.product_id) ?? entityId(item.product)
    if (itemProductId) return itemProductId
  }

  return null
}

function planEventLike(event: CreemEvent): CreemPlanEventLike {
  const subscription = subscriptionFromEvent(event)

  return {
    metadata: metadataFromEvent(event),
    product: subscription?.product ?? event.object?.product ?? null,
    items: subscription?.items ?? event.object?.items ?? null,
  }
}

async function insertEventOnce(
  database: EventInsertDatabase,
  event: CreemEvent,
): Promise<'inserted' | 'duplicate'> {
  try {
    await database.insert(schema.creemEvents).values({
      id: event.id!,
      event_type: event.eventType ?? 'unknown',
      occurred_at: parseDate(event.created_at),
    })
    return 'inserted'
  } catch (error) {
    if (isDuplicateEntryError(error)) return 'duplicate'
    throw error
  }
}

async function resolveTargetUserId(event: CreemEvent): Promise<string | null> {
  const metadata = metadataFromEvent(event)
  const userIdFromMetadata = asString(metadata?.user_id) ?? asString(metadata?.referenceId)
  if (userIdFromMetadata) return userIdFromMetadata

  const subscriptionId = asString(subscriptionFromEvent(event)?.id) ?? entityId(event.object?.subscription)
  if (!subscriptionId) return null

  const existing = await db
    .select({ user_id: schema.subscriptions.user_id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.creem_subscription_id, subscriptionId))
    .then(rows => rows[0] ?? null)

  return existing?.user_id ?? null
}

function subscriptionStatusFromEvent(event: CreemEvent): string | null {
  return asString(subscriptionFromEvent(event)?.status)
}

function customerIdFromEvent(event: CreemEvent): string | null {
  const subscription = subscriptionFromEvent(event)
  return entityId(subscription?.customer) ?? entityId(event.object?.customer)
}

function buildSubscriptionUpdate(input: {
  event: CreemEvent
  plan: AppPlan | null
  localStatus: LocalSubscriptionStatus | null
  resetToFree: boolean
}) {
  const subscription = subscriptionFromEvent(input.event)
  const creemStatus = subscriptionStatusFromEvent(input.event)
  const creemProductId = productIdFromEvent(input.event)
  const currentPeriodEnd = parseDate(subscription?.current_period_end_date ?? null)

  const update: Record<string, unknown> = {
    creem_customer_id: customerIdFromEvent(input.event),
    creem_subscription_id: asString(subscription?.id) ?? entityId(input.event.object?.subscription),
    creem_product_id: creemProductId,
    creem_status: creemStatus,
    creem_updated_at: new Date(),
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

// POST /api/webhooks/creem — Creem Billing webhook receiver
export async function POST(req: NextRequest) {
  const config = resolveCreemConfig()
  if (!config.webhookSecret) {
    return err('INTERNAL_ERROR', 'Creem webhook secret is not configured')
  }

  const rawBody = await req.text()
  const signature = req.headers.get('creem-signature')
  if (!verifyCreemWebhookSignature(rawBody, signature, config.webhookSecret)) {
    return err('UNAUTHORIZED', 'Invalid Creem signature')
  }

  const event = parseCreemEvent(rawBody)
  if (!event || !event.id || !event.object) {
    return err('VALIDATION_ERROR', 'Invalid Creem webhook payload')
  }

  if (!isSubscriptionEvent(event)) {
    const eventInsert = await insertEventOnce(db, event)
    if (eventInsert === 'duplicate') {
      return ok({ duplicate: true })
    }

    return ok({ ignored: true })
  }

  const eventLike = planEventLike(event)
  if (!isShowrunnerCreemEvent(eventLike, config)) {
    console.warn(`[creem] webhook ignored, event is not for Showrunner event=${event.id}`)
    return ok({ ignored: true })
  }

  const userId = await resolveTargetUserId(event)
  if (!userId) {
    console.warn(`[creem] webhook ignored, subscription owner not found event=${event.id}`)
    return ok({ ignored: true })
  }

  const paidPlan = resolveCreemPlanFromEvent(eventLike, config)
  const statusMapping = mapCreemSubscriptionStatus(subscriptionStatusFromEvent(event), event.eventType)
  const update = buildSubscriptionUpdate({
    event,
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
