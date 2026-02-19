import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recordQueue } from '@/lib/queue'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// POST /api/demos/[id]/start — 用户确认步骤后触发录制
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const supabase = createAdminClient()

  // 获取 Demo 及其步骤
  const { data: demo } = await supabase
    .from('demos')
    .select('id, status, steps(id, position, title, action_type, selector, value, narration, status)')
    .eq('id', id)
    .eq('user_id', user.id)
    .order('position', { referencedTable: 'steps', ascending: true })
    .single()

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  // 只有 review 状态才能开始录制
  if (demo.status !== 'review') {
    return err('DEMO_NOT_READY', `当前状态 "${demo.status}" 不允许触发录制，需要为 "review"`)
  }

  if (!demo.steps?.length) {
    return err('DEMO_NOT_READY', '没有可录制的步骤，请先等待 AI 解析完成')
  }

  // 更新状态
  await supabase.from('demos').update({ status: 'recording' }).eq('id', id)

  // 入队 record-queue
  await recordQueue.add('record', {
    demoId: id,
    steps:  demo.steps,
  }, {
    attempts: 1,       // 录制失败由用户手动介入，不自动重试
    removeOnComplete: true,
  })

  return ok({ id, status: 'recording' })
}
