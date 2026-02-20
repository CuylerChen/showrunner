import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'
import fs from 'fs'
import path from 'path'

type Params = { params: Promise<{ id: string }> }

const VIDEO_DIR = process.env.VIDEO_DIR ?? '/data/videos'

// GET /api/demos/[id] — 获取 Demo 详情（含 steps）
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params

  const demo = await db
    .select()
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.demo_id, id))
    .orderBy(asc(schema.steps.position))

  return ok({ ...demo, steps })
}

// PATCH /api/demos/[id] — 更新 Demo 标题 / CTA 设置
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const schema2 = z.object({
    title:    z.string().min(1).max(100).optional(),
    cta_url:  z.string().url().max(2048).nullable().optional(),
    cta_text: z.string().max(100).nullable().optional(),
  }).refine(d => Object.keys(d).length > 0, { message: '至少提供一个更新字段' })

  const parsed = schema2.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? '参数错误')

  const updates: Record<string, unknown> = {}
  if (parsed.data.title    !== undefined) updates.title    = parsed.data.title
  if (parsed.data.cta_url  !== undefined) updates.cta_url  = parsed.data.cta_url
  if (parsed.data.cta_text !== undefined) updates.cta_text = parsed.data.cta_text

  const updated = await db
    .update(schema.demos)
    .set(updates)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))

  if (!updated[0] || (updated[0] as any).affectedRows === 0) {
    return err('NOT_FOUND', 'Demo 不存在或无权访问')
  }

  return ok({ id, ...updates })
}

// DELETE /api/demos/[id] — 删除 Demo 及视频文件
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params

  const demo = await db
    .select({ id: schema.demos.id, video_url: schema.demos.video_url })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  // 删除本地视频文件
  if (demo.video_url) {
    const videoPath = path.join(VIDEO_DIR, id, 'final.mp4')
    try {
      fs.rmSync(path.dirname(videoPath), { recursive: true, force: true })
    } catch {
      // 文件不存在时忽略
    }
  }

  // 先删除关联的 steps 和 jobs（防止外键约束）
  await db.delete(schema.steps).where(eq(schema.steps.demo_id, id))
  await db.delete(schema.jobs).where(eq(schema.jobs.demo_id, id))
  await db.delete(schema.demos).where(eq(schema.demos.id, id))

  return ok({ id })
}
