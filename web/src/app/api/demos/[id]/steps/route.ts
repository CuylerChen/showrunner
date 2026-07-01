import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import { ok, err } from '@/lib/api'
import { canUsePerSceneVoice, isTtsVoiceId } from '@/lib/plans'
import {
  assertPromptAllowedByCreem,
  composeStepsModerationPrompt,
  handleContentModerationError,
} from '@/lib/moderation/creem'

type Params = { params: Promise<{ id: string }> }
type StepVisualType = 'screenshot' | 'template' | 'cta'
type StepUpdates = {
  position: number
  title: string
  narration: string | null
  tts_voice_id?: string | null
  visual_type?: StepVisualType
  visual_asset_url?: string | null
}

const UpdateStepsSchema = z.object({
  steps: z.array(z.object({
    id:               z.string().uuid(),
    position:         z.number().int().min(1),
    title:            z.string().min(1).max(255),
    narration:        z.string().max(1000).nullable().optional(),
    tts_voice_id:     z.string().max(40).nullable().optional(),
    visual_type:      z.enum(['screenshot', 'template', 'cta']).optional(),
    visual_asset_url: z.string().max(2048).nullable().optional(),
  })).min(1),
})

// PUT /api/demos/[id]/steps — 批量更新步骤（排序 + 编辑旁白）
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = UpdateStepsSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(e => e.message).join(', '))
  }

  // 确认 Demo 归属且处于 review 状态
  const demo = await db
    .select({ id: schema.demos.id, status: schema.demos.status })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')
  if (demo.status !== 'review') return err('DEMO_NOT_READY', '只能在 review 状态下编辑步骤')
  const subscription = await getSubscription(user.id)
  if (!subscription) return err('SUBSCRIPTION_NOT_FOUND', '订阅信息不存在')

  for (const step of parsed.data.steps) {
    const voiceId = step.tts_voice_id ?? null
    if (!voiceId) continue
    if (!isTtsVoiceId(voiceId)) return err('VALIDATION_ERROR', '请选择有效的旁白声音')
    if (voiceId !== 'default' && !canUsePerSceneVoice(subscription.plan, voiceId)) {
      return err('PLAN_RESTRICTED', '当前套餐不支持为每个分镜设置不同人物声音')
    }
  }

  const existingSteps = await db
    .select({
      id: schema.steps.id,
      custom_audio_path: schema.steps.custom_audio_path,
    })
    .from(schema.steps)
    .where(eq(schema.steps.demo_id, id))

  const existingStepIds = new Set(existingSteps.map(step => step.id))
  for (const step of parsed.data.steps) {
    if (!existingStepIds.has(step.id)) return err('NOT_FOUND', '分镜不存在或无权访问')
  }

  try {
    await assertPromptAllowedByCreem(
      composeStepsModerationPrompt(parsed.data.steps),
      { externalId: `user_${user.id}:demo_${id}:steps_update` },
    )
  } catch (moderationError) {
    return handleContentModerationError(moderationError)
  }

  const submittedStepIds = new Set(parsed.data.steps.map(step => step.id))
  const deletedSteps = existingSteps.filter(step => !submittedStepIds.has(step.id))

  await db.transaction(async tx => {
    for (const step of deletedSteps) {
      await tx.delete(schema.steps).where(and(eq(schema.steps.id, step.id), eq(schema.steps.demo_id, id)))
    }

    for (const [index, s] of parsed.data.steps.entries()) {
      const updates: StepUpdates = {
        position: index + 1,
        title: s.title,
        narration: s.narration ?? null,
      }
      if (s.tts_voice_id !== undefined) updates.tts_voice_id = s.tts_voice_id || null
      if (s.visual_type !== undefined) updates.visual_type = s.visual_type
      if (s.visual_asset_url !== undefined) updates.visual_asset_url = s.visual_asset_url

      await tx
        .update(schema.steps)
        .set(updates)
        .where(and(eq(schema.steps.id, s.id), eq(schema.steps.demo_id, id)))
    }
  })

  await Promise.all(deletedSteps
    .map(step => step.custom_audio_path)
    .filter((filePath): filePath is string => Boolean(filePath))
    .map(filePath => fs.unlink(filePath).catch(() => undefined)))

  return ok({ updated: parsed.data.steps.length })
}
