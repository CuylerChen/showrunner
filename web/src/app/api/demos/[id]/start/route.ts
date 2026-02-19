import { NextRequest } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { recordQueue } from '@/lib/queue'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// POST /api/demos/[id]/start — 用户确认步骤后触发录制
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params

  const demo = await db
    .select({ id: schema.demos.id, status: schema.demos.status })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  if (demo.status !== 'review') {
    return err('DEMO_NOT_READY', `当前状态 "${demo.status}" 不允许触发录制，需要为 "review"`)
  }

  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.demo_id, id))
    .orderBy(asc(schema.steps.position))

  if (!steps.length) {
    return err('DEMO_NOT_READY', '没有可录制的步骤，请先等待 AI 解析完成')
  }

  await db
    .update(schema.demos)
    .set({ status: 'recording' })
    .where(eq(schema.demos.id, id))

  await recordQueue.add('record', { demoId: id, steps }, {
    attempts: 1,
    removeOnComplete: true,
  })

  return ok({ id, status: 'recording' })
}
