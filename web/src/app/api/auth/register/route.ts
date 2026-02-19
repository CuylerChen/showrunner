import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { signJwt } from '@/lib/jwt'
import { ok, err } from '@/lib/api'
import { cookies } from 'next/headers'

const RegisterSchema = z.object({
  email:    z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少 8 位'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(e => e.message).join(', '))
  }

  const { email, password } = parsed.data

  // 检查邮箱是否已注册
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .then(rows => rows[0] ?? null)

  if (existing) return err('VALIDATION_ERROR', '该邮箱已被注册')

  // 哈希密码
  const password_hash = await bcrypt.hash(password, 12)

  // 创建用户
  const userId = crypto.randomUUID()
  await db.insert(schema.users).values({ id: userId, email, password_hash })

  // 创建默认订阅（free 套餐）
  const subId = crypto.randomUUID()
  await db.insert(schema.subscriptions).values({
    id:      subId,
    user_id: userId,
    plan:    'free',
    status:  'active',
    demos_used_this_month: 0,
    demos_limit:           3,
  })

  // 签发 JWT，写入 cookie
  const token = await signJwt({ sub: userId, email })
  const cookieStore = await cookies()
  cookieStore.set('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 7, // 7 天
  })

  return ok({ id: userId, email }, 201)
}
