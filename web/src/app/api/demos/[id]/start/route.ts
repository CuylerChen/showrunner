import { NextRequest } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { ttsQueue } from '@/lib/queue'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import { ok, err } from '@/lib/api'
import { getTtsQueuePriority } from '@/lib/plans'

type Params = { params: Promise<{ id: string }> }

// POST /api/demos/[id]/start — 用户确认场景后触发推广视频生成
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params

  const demo = await db
    .select({
      id: schema.demos.id,
      status: schema.demos.status,
      tts_voice_id: schema.demos.tts_voice_id,
      tts_speed: schema.demos.tts_speed,
    })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  if (demo.status !== 'review') {
    return err('DEMO_NOT_READY', `当前状态 "${demo.status}" 不允许生成视频，需要为 "review"`)
  }

  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.demo_id, id))
    .orderBy(asc(schema.steps.position))

  if (!steps.length) {
    return err('DEMO_NOT_READY', '没有可生成的视频场景，请先等待 AI 分析完成')
  }
  const subscription = await getSubscription(user.id)
  if (!subscription) return err('SUBSCRIPTION_NOT_FOUND', '订阅信息不存在')

  try {
    await db
      .update(schema.demos)
      .set({ status: 'processing', error_message: null })
      .where(eq(schema.demos.id, id))

    await ttsQueue.add('tts', {
      demoId: id,
      steps,
      ttsVoiceId: demo.tts_voice_id ?? 'default',
      ttsSpeed: demo.tts_speed ?? 100,
      renderMode: 'promotional',
    }, {
      priority: getTtsQueuePriority(subscription.plan),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    })
  } catch (queueError) {
    await db
      .update(schema.demos)
      .set({
        status: 'review',
        error_message: `START_FAILED: ${(queueError as Error).message}`,
      })
      .where(eq(schema.demos.id, id))
    return err('START_FAILED', '视频生成任务入队失败，请稍后重试')
  }

  return ok({ id, status: 'processing' })
}
