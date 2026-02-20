import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { signJwt } from '@/lib/jwt'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const cookieStore = await cookies()
  const savedState  = cookieStore.get('oauth_state')?.value
  cookieStore.delete('oauth_state')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const fail   = (reason: string) =>
    NextResponse.redirect(`${appUrl}/sign-in?error=${reason}`)

  if (oauthError || !code)               return fail('oauth_denied')
  if (!state || state !== savedState)    return fail('oauth_state_mismatch')

  // 用 code 换取 access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  `${appUrl}/api/auth/callback/google`,
    }).toString(),
  })

  if (!tokenRes.ok) return fail('oauth_token_failed')
  const { access_token } = await tokenRes.json() as { access_token: string }

  // 获取 Google 用户信息
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!profileRes.ok) return fail('oauth_profile_failed')

  const { id: googleId, email } = await profileRes.json() as { id: string; email: string }
  if (!email) return fail('oauth_no_email')

  // 查找或创建用户
  let userId: string
  let userEmail: string

  // 先按 oauth_id 查
  const byOauth = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(and(
      eq(schema.users.oauth_provider, 'google'),
      eq(schema.users.oauth_id, googleId),
    ))
    .then(r => r[0] ?? null)

  if (byOauth) {
    userId    = byOauth.id
    userEmail = byOauth.email
  } else {
    // 再按邮箱查（可能已用邮箱注册）
    const byEmail = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .then(r => r[0] ?? null)

    if (byEmail) {
      // 将 OAuth 信息绑定到已有账号
      await db.update(schema.users)
        .set({ oauth_provider: 'google', oauth_id: googleId })
        .where(eq(schema.users.id, byEmail.id))
      userId    = byEmail.id
      userEmail = byEmail.email
    } else {
      // 全新用户
      userId    = crypto.randomUUID()
      userEmail = email
      await db.insert(schema.users).values({
        id:             userId,
        email:          userEmail,
        oauth_provider: 'google',
        oauth_id:       googleId,
      })
      await db.insert(schema.subscriptions).values({
        id:                    crypto.randomUUID(),
        user_id:               userId,
        plan:                  'free',
        status:                'active',
        demos_used_this_month: 0,
        demos_limit:           3,
      })
    }
  }

  // 签发 JWT，写入 cookie
  const token = await signJwt({ sub: userId, email: userEmail })
  cookieStore.set('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 7,
  })

  return NextResponse.redirect(`${appUrl}/dashboard`)
}
