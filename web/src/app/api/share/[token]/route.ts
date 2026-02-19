import { NextRequest } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ token: string }> }

// GET /api/share/[token] — 公开分享页数据（无需鉴权）
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  const demo = await db
    .select({
      title:     schema.demos.title,
      video_url: schema.demos.video_url,
      duration:  schema.demos.duration,
    })
    .from(schema.demos)
    .where(and(eq(schema.demos.share_token, token), eq(schema.demos.status, 'completed')))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', '分享页不存在或 Demo 尚未生成完成')

  // 获取 Demo ID 用于查询 steps（通过 share_token 找 demo id）
  const demoRow = await db
    .select({ id: schema.demos.id })
    .from(schema.demos)
    .where(eq(schema.demos.share_token, token))
    .then(rows => rows[0])

  const steps = demoRow
    ? await db
        .select({
          position:        schema.steps.position,
          title:           schema.steps.title,
          timestamp_start: schema.steps.timestamp_start,
          timestamp_end:   schema.steps.timestamp_end,
        })
        .from(schema.steps)
        .where(eq(schema.steps.demo_id, demoRow.id))
        .orderBy(asc(schema.steps.position))
    : []

  return ok({
    title:     demo.title,
    video_url: demo.video_url,
    duration:  demo.duration,
    steps,
  })
}
