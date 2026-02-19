import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { signJwt } from '@/lib/jwt'
import { ok, err } from '@/lib/api'
import { cookies } from 'next/headers'

const LoginSchema = z.object({
  email:    z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(e => e.message).join(', '))
  }

  const { email, password } = parsed.data

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .then(rows => rows[0] ?? null)

  if (!user) return err('UNAUTHORIZED', '邮箱或密码错误')

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return err('UNAUTHORIZED', '邮箱或密码错误')

  const token = await signJwt({ sub: user.id, email: user.email })
  const cookieStore = await cookies()
  cookieStore.set('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 7,
  })

  return ok({ id: user.id, email: user.email })
}
