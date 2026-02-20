import { NextRequest } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ token: string }> }

// POST /api/share/[token]/view — 无需鉴权，记录一次观看
export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params

  const result = await db
    .update(schema.demos)
    .set({ view_count: sql`${schema.demos.view_count} + 1` })
    .where(
      and(
        eq(schema.demos.share_token, token),
        eq(schema.demos.status, 'completed'),
      )
    )

  const affected = (result[0] as any).affectedRows ?? 0
  if (affected === 0) return err('NOT_FOUND', '分享页不存在')

  return ok({ recorded: true })
}
