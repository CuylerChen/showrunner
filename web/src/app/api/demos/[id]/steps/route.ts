import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const StepUpdateSchema = z.object({
  steps: z.array(z.object({
    id:        z.string().uuid(),
    position:  z.number().int().min(1),
    title:     z.string().min(1).max(100),
    narration: z.string().max(500).optional(),
  })).min(1),
})

// PUT /api/demos/[id]/steps — 批量更新步骤（排序 + 编辑旁白）
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = StepUpdateSchema.safeParse(body)
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

  await Promise.all(parsed.data.steps.map(s =>
    db
      .update(schema.steps)
      .set({ position: s.position, title: s.title, narration: s.narration })
      .where(and(eq(schema.steps.id, s.id), eq(schema.steps.demo_id, id)))
  ))

  return ok({ updated: parsed.data.steps.length })
}
