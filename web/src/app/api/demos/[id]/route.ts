import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// GET /api/demos/[id] — 获取 Demo 详情（含 steps）
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const supabase = createAdminClient()

  const { data: demo, error } = await supabase
    .from('demos')
    .select(`
      id, title, product_url, description, status,
      video_url, duration, share_token, error_message, created_at,
      steps (
        id, position, title, action_type, selector, value,
        narration, timestamp_start, timestamp_end, status
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .order('position', { referencedTable: 'steps', ascending: true })
    .single()

  if (error || !demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  return ok(demo)
}

// PATCH /api/demos/[id] — 更新 Demo 标题
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const schema = z.object({ title: z.string().min(1).max(100) })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', '标题不能为空且不超过 100 字符')

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('demos')
    .update({ title: parsed.data.title })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title')
    .single()

  if (error || !data) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  return ok(data)
}

// DELETE /api/demos/[id] — 删除 Demo 及视频文件
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const supabase = createAdminClient()

  // 确认归属
  const { data: demo } = await supabase
    .from('demos')
    .select('id, video_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  // 删除 Supabase Storage 视频文件
  if (demo.video_url) {
    await supabase.storage.from('videos').remove([`${id}/final.mp4`])
  }

  // 删除数据库记录（steps/jobs 通过级联删除）
  await supabase.from('demos').delete().eq('id', id)

  return ok({ id })
}
