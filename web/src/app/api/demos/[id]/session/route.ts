import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// Playwright Cookie 格式校验
const CookieSchema = z.object({
  name:     z.string().min(1),
  value:    z.string(),
  domain:   z.string().min(1),
  path:     z.string().default('/'),
  expires:  z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure:   z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
})

const BodySchema = z.object({
  cookies: z.array(CookieSchema).min(1, '至少提供一个 Cookie'),
})

// POST /api/demos/[id]/session — 保存登录 Session Cookies
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', '参数错误：请提供正确的 Cookie 数组')

  // 确认 demo 归属当前用户
  const demo = await db
    .select({ id: schema.demos.id })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  await db
    .update(schema.demos)
    .set({ session_cookies: JSON.stringify(parsed.data.cookies) })
    .where(eq(schema.demos.id, id))

  return ok({ id, cookieCount: parsed.data.cookies.length })
}

// DELETE /api/demos/[id]/session — 清除登录 Session Cookies
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const { id } = await params

  const demo = await db
    .select({ id: schema.demos.id })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, user.id)))
    .then(rows => rows[0] ?? null)

  if (!demo) return err('NOT_FOUND', 'Demo 不存在或无权访问')

  await db
    .update(schema.demos)
    .set({ session_cookies: null })
    .where(eq(schema.demos.id, id))

  return ok({ id, cleared: true })
}
