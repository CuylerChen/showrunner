import { headers } from 'next/headers'
import { db, schema } from './db'
import { eq } from 'drizzle-orm'
import { err } from './api'
import { computeSubscriptionPeriodUpdate } from './subscription-period'

export async function getCurrentUser() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  if (!userId) return { user: null, response: err('UNAUTHORIZED', '请先登录') }

  const user = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .then(rows => rows[0] ?? null)

  if (!user) return { user: null, response: err('UNAUTHORIZED', '用户不存在') }

  return { user, response: null }
}

export async function getSubscription(userId: string) {
  const sub = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.user_id, userId))
    .then(rows => rows[0] ?? null)
  if (!sub) return null

  const periodUpdate = computeSubscriptionPeriodUpdate(sub)
  if (!periodUpdate) return sub

  await db
    .update(schema.subscriptions)
    .set(periodUpdate)
    .where(eq(schema.subscriptions.user_id, userId))

  return { ...sub, ...periodUpdate }
}
