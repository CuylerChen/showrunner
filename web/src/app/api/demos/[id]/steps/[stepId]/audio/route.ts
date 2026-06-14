import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { ok, err } from '@/lib/api'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import { canUseCustomAudio } from '@/lib/plans'
import { getVideoStorageDir } from '@/lib/video-storage'

type Params = { params: Promise<{ id: string; stepId: string }> }

const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/x-m4a',
])
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a'])

function safeAudioExtension(file: File): string | null {
  const ext = path.extname(file.name).toLowerCase()
  if (ALLOWED_AUDIO_EXTENSIONS.has(ext)) return ext
  if (file.type === 'audio/mpeg' || file.type === 'audio/mp3') return '.mp3'
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav' || file.type === 'audio/wave') return '.wav'
  if (file.type === 'audio/mp4' || file.type === 'audio/x-m4a') return '.m4a'
  return null
}

async function getEditableStep(demoId: string, stepId: string, userId: string) {
  return db
    .select({
      demoId: schema.demos.id,
      status: schema.demos.status,
      stepId: schema.steps.id,
      customAudioPath: schema.steps.custom_audio_path,
    })
    .from(schema.steps)
    .innerJoin(schema.demos, eq(schema.steps.demo_id, schema.demos.id))
    .where(and(
      eq(schema.demos.id, demoId),
      eq(schema.demos.user_id, userId),
      eq(schema.steps.id, stepId),
    ))
    .then(rows => rows[0] ?? null)
}

async function assertCanUseCustomAudio(userId: string) {
  const subscription = await getSubscription(userId)
  if (!subscription) return err('SUBSCRIPTION_NOT_FOUND', '订阅信息不存在')
  if (!canUseCustomAudio(subscription.plan)) {
    return err('PLAN_RESTRICTED', '当前套餐不支持上传分镜自定义音频')
  }
  return null
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const restriction = await assertCanUseCustomAudio(user.id)
  if (restriction) return restriction

  const { id, stepId } = await params
  const step = await getEditableStep(id, stepId, user.id)
  if (!step) return err('NOT_FOUND', '分镜不存在或无权访问')
  if (step.status !== 'review') return err('DEMO_NOT_READY', '只能在 review 状态下上传分镜音频')

  const form = await req.formData().catch(() => null)
  const file = form?.get('audio')
  if (!(file instanceof File)) return err('VALIDATION_ERROR', '请上传音频文件')
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
    return err('VALIDATION_ERROR', '音频文件大小需在 20MB 以内')
  }
  if (file.type && !ALLOWED_AUDIO_TYPES.has(file.type)) {
    return err('VALIDATION_ERROR', '仅支持 mp3、wav 或 m4a 音频')
  }

  const ext = safeAudioExtension(file)
  if (!ext) return err('VALIDATION_ERROR', '仅支持 mp3、wav 或 m4a 音频')

  const audioDir = path.join(getVideoStorageDir(), id, 'custom-audio')
  await fs.mkdir(audioDir, { recursive: true })

  const filename = `${stepId}-${crypto.randomUUID()}${ext}`
  const outputPath = path.join(audioDir, filename)
  await fs.writeFile(outputPath, Buffer.from(await file.arrayBuffer()))

  if (step.customAudioPath) {
    await fs.unlink(step.customAudioPath).catch(() => undefined)
  }

  await db
    .update(schema.steps)
    .set({
      custom_audio_path: outputPath,
      custom_audio_name: file.name.slice(0, 255),
    })
    .where(and(eq(schema.steps.id, stepId), eq(schema.steps.demo_id, id)))

  return ok({
    step_id: stepId,
    custom_audio_path: outputPath,
    custom_audio_name: file.name.slice(0, 255),
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const restriction = await assertCanUseCustomAudio(user.id)
  if (restriction) return restriction

  const { id, stepId } = await params
  const step = await getEditableStep(id, stepId, user.id)
  if (!step) return err('NOT_FOUND', '分镜不存在或无权访问')
  if (step.status !== 'review') return err('DEMO_NOT_READY', '只能在 review 状态下删除分镜音频')

  if (step.customAudioPath) {
    await fs.unlink(step.customAudioPath).catch(() => undefined)
  }

  await db
    .update(schema.steps)
    .set({ custom_audio_path: null, custom_audio_name: null })
    .where(and(eq(schema.steps.id, stepId), eq(schema.steps.demo_id, id)))

  return ok({ step_id: stepId, custom_audio_path: null, custom_audio_name: null })
}
