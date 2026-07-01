import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and, asc, ne } from 'drizzle-orm'
import { recordQueue } from '@/lib/queue'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import { ok, err } from '@/lib/api'
import { getTtsQueuePriority } from '@/lib/plans'
import {
  assertPromptAllowedByCreem,
  composeStepsModerationPrompt,
  handleContentModerationError,
} from '@/lib/moderation/creem'

type Params = { params: Promise<{ id: string; stepId: string }> }

const ResolveSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('skip') }),
  z.object({ action: z.literal('retry') }),
  z.object({ action: z.literal('manual'), manual_description: z.string().min(5, '请描述该步骤的操作') }),
])

// POST /api/demos/[id]/steps/[stepId]/resolve — 录制失败后用户介入
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id, stepId } = await params
  const body = await req.json().catch(() => null)
  const parsed = ResolveSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(e => e.message).join(', '))
  }

  // 确认 Demo 处于 paused 状态
  const demo = await db
    .select({ id: schema.demos.id, status: schema.demos.status })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo)                    return err('NOT_FOUND',      'Demo 不存在或无权访问')
  if (demo.status !== 'paused') return err('DEMO_NOT_READY', '只能对 paused 状态的 Demo 进行介入')
  const subscription = await getSubscription(user.id)
  if (!subscription) return err('SUBSCRIPTION_NOT_FOUND', '订阅信息不存在')

  const { action } = parsed.data

  if (action === 'skip') {
    await db.update(schema.steps).set({ status: 'skipped' }).where(eq(schema.steps.id, stepId))
  }

  if (action === 'manual') {
    try {
      await assertPromptAllowedByCreem(
        composeStepsModerationPrompt([{ title: 'Manual scene instruction', narration: parsed.data.manual_description }]),
        { externalId: `user_${user.id}:demo_${id}:step_${stepId}:manual` },
      )
    } catch (moderationError) {
      return handleContentModerationError(moderationError)
    }

    await db
      .update(schema.steps)
      .set({ narration: parsed.data.manual_description, status: 'pending' })
      .where(eq(schema.steps.id, stepId))
  }

  if (action === 'retry') {
    await db.update(schema.steps).set({ status: 'pending' }).where(eq(schema.steps.id, stepId))
  }

  // 取所有未完成 + 未跳过的步骤重新录制
  const remainingSteps = await db
    .select()
    .from(schema.steps)
    .where(
      and(
        eq(schema.steps.demo_id, id),
        ne(schema.steps.status, 'completed'),
        ne(schema.steps.status, 'skipped'),
      )
    )
    .orderBy(asc(schema.steps.position))

  if (remainingSteps.length === 0) {
    return err('DEMO_NOT_READY', '没有需要重录的步骤')
  }

  try {
    await assertPromptAllowedByCreem(
      composeStepsModerationPrompt(remainingSteps),
      { externalId: `user_${user.id}:demo_${id}:record_retry` },
    )
  } catch (moderationError) {
    return handleContentModerationError(moderationError)
  }

  try {
    await db
      .update(schema.demos)
      .set({ status: 'recording', error_message: null })
      .where(eq(schema.demos.id, id))

    await recordQueue.add('record', { demoId: id, steps: remainingSteps }, {
      priority: getTtsQueuePriority(subscription.plan),
      attempts: 1,
      removeOnComplete: true,
    })
  } catch (queueError) {
    await db
      .update(schema.demos)
      .set({
        status: 'paused',
        error_message: `RECORD_RETRY_FAILED: ${(queueError as Error).message}`,
      })
      .where(eq(schema.demos.id, id))
    return err('RECORD_RETRY_FAILED', '重录任务入队失败，请稍后重试')
  }

  return ok({ demo_id: id, status: 'recording' })
}
