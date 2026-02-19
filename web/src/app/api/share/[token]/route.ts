import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ token: string }> }

// GET /api/share/[token] — 公开分享页数据（无需鉴权）
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: demo, error } = await supabase
    .from('demos')
    .select(`
      title, video_url, duration,
      steps (
        position, title, timestamp_start, timestamp_end
      )
    `)
    .eq('share_token', token)
    .eq('status', 'completed')
    .order('position', { referencedTable: 'steps', ascending: true })
    .single()

  if (error || !demo) return err('NOT_FOUND', '分享页不存在或 Demo 尚未生成完成')

  // 只返回展示所需字段，不暴露 selector/value 等内部数据
  return ok({
    title:     demo.title,
    video_url: demo.video_url,
    duration:  demo.duration,
    steps:     (demo.steps ?? []).map((s: any) => ({
      position:        s.position,
      title:           s.title,
      timestamp_start: s.timestamp_start,
      timestamp_end:   s.timestamp_end,
    })),
  })
}
