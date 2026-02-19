import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { recordQueue } from '@/lib/queue'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

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
    return err('VALIDATION_ERROR', parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
  }

  const supabase = createAdminClient()

  // 确认 Demo 处于 paused 状态
  const { data: demo } = await supabase
    .from('demos')
    .select('id, status, steps(id, position, title, action_type, selector, value, narration, status)')
    .eq('id', id)
    .eq('user_id', user.id)
    .order('position', { referencedTable: 'steps', ascending: true })
    .single()

  if (!demo)              return err('NOT_FOUND',      'Demo 不存在或无权访问')
  if (demo.status !== 'paused') return err('DEMO_NOT_READY', '只能对 paused 状态的 Demo 进行介入')

  const { action } = parsed.data

  if (action === 'skip') {
    // 跳过失败步骤
    await supabase.from('steps').update({ status: 'skipped' }).eq('id', stepId)
  }

  if (action === 'manual') {
    // 用简单描述替换失败步骤的旁白，selector 清空让 Playwright 尝试新描述
    await supabase
      .from('steps')
      .update({
        narration: (parsed.data as any).manual_description,
        status:    'pending',
      })
      .eq('id', stepId)
  }

  if (action === 'retry') {
    // 重置失败步骤状态为 pending
    await supabase.from('steps').update({ status: 'pending' }).eq('id', stepId)
  }

  // 取所有未完成 + 未跳过的步骤重新录制
  const remainingSteps = (demo.steps ?? []).filter(
    s => s.status !== 'completed' && s.status !== 'skipped'
  )

  if (remainingSteps.length === 0) {
    return err('DEMO_NOT_READY', '没有需要重录的步骤')
  }

  // 重新入队 record-queue
  await supabase.from('demos').update({ status: 'recording', error_message: null }).eq('id', id)
  await recordQueue.add('record', { demoId: id, steps: remainingSteps }, {
    attempts: 1,
    removeOnComplete: true,
  })

  return ok({ demo_id: id, status: 'recording' })
}
