import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
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
    return err('VALIDATION_ERROR', parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
  }

  const supabase = createAdminClient()

  // 确认 Demo 归属且处于 review 状态（才允许编辑步骤）
  const { data: demo } = await supabase
    .from('demos')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')
  if (demo.status !== 'review') return err('DEMO_NOT_READY', '只能在 review 状态下编辑步骤')

  // 逐条 upsert（Supabase 不支持批量更新不同值）
  const updates = parsed.data.steps.map(s =>
    supabase
      .from('steps')
      .update({ position: s.position, title: s.title, narration: s.narration })
      .eq('id', s.id)
      .eq('demo_id', id)
  )

  await Promise.all(updates)

  return ok({ updated: parsed.data.steps.length })
}
