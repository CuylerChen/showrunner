import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { signJwt } from '@/lib/jwt'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code      = searchParams.get('code')
  const state     = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const cookieStore = await cookies()
  const savedState  = cookieStore.get('oauth_state')?.value
  cookieStore.delete('oauth_state')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const fail   = (reason: string) =>
    NextResponse.redirect(`${appUrl}/sign-in?error=${reason}`)

  if (oauthError || !code)            return fail('oauth_denied')
  if (!state || state !== savedState) return fail('oauth_state_mismatch')

  // 用 code 换取 access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri:  `${appUrl}/api/auth/callback/github`,
    }),
  })

  if (!tokenRes.ok) return fail('oauth_token_failed')
  const { access_token } = await tokenRes.json() as { access_token?: string }
  if (!access_token)  return fail('oauth_token_failed')

  // 获取 GitHub 用户信息
  const profileRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${access_token}`,
      Accept:        'application/vnd.github+json',
    },
  })
  if (!profileRes.ok) return fail('oauth_profile_failed')
  const githubUser = await profileRes.json() as { id: number; email?: string | null }

  // GitHub 可能不公开邮箱，需要单独请求 emails 接口
  let email = githubUser.email ?? ''
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept:        'application/vnd.github+json',
      },
    })
    if (emailsRes.ok) {
      const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>
      const primary = emails.find(e => e.primary && e.verified)
      email = primary?.email ?? emails[0]?.email ?? ''
    }
  }

  if (!email) return fail('oauth_no_email')

  const githubId = String(githubUser.id)

  // 查找或创建用户
  let userId: string
  let userEmail: string

  const byOauth = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(and(
      eq(schema.users.oauth_provider, 'github'),
      eq(schema.users.oauth_id, githubId),
    ))
    .then(r => r[0] ?? null)

  if (byOauth) {
    userId    = byOauth.id
    userEmail = byOauth.email
  } else {
    const byEmail = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .then(r => r[0] ?? null)

    if (byEmail) {
      await db.update(schema.users)
        .set({ oauth_provider: 'github', oauth_id: githubId })
        .where(eq(schema.users.id, byEmail.id))
      userId    = byEmail.id
      userEmail = byEmail.email
    } else {
      userId    = crypto.randomUUID()
      userEmail = email
      await db.insert(schema.users).values({
        id:             userId,
        email:          userEmail,
        oauth_provider: 'github',
        oauth_id:       githubId,
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
