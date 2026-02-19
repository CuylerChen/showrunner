import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/server'

type ClerkEvent =
  | { type: 'user.created'; data: { id: string; email_addresses: { email_address: string }[] } }
  | { type: 'user.updated'; data: { id: string; email_addresses: { email_address: string }[] } }
  | { type: 'user.deleted'; data: { id: string } }

// POST /api/webhooks/clerk — 用户同步
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook secret 未配置', { status: 500 })

  // 验证 Clerk 签名
  const svix = new Webhook(secret)
  const body = await req.text()
  let event: ClerkEvent

  try {
    event = svix.verify(body, {
      'svix-id':        req.headers.get('svix-id')        ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as ClerkEvent
  } catch {
    return new Response('签名验证失败', { status: 400 })
  }

  const supabase = createAdminClient()

  if (event.type === 'user.created') {
    const email = event.data.email_addresses[0]?.email_address ?? ''

    // 创建用户记录
    const { data: user } = await supabase
      .from('users')
      .insert({ clerk_id: event.data.id, email })
      .select('id')
      .single()

    // 初始化免费套餐
    if (user) {
      await supabase.from('subscriptions').insert({
        user_id:     user.id,
        plan:        'free',
        status:      'active',
        demos_limit: 1,
      })
    }
  }

  if (event.type === 'user.updated') {
    const email = event.data.email_addresses[0]?.email_address
    if (email) {
      await supabase.from('users').update({ email }).eq('clerk_id', event.data.id)
    }
  }

  if (event.type === 'user.deleted') {
    // 级联删除：demos/steps/jobs/subscriptions 通过数据库外键自动清理
    await supabase.from('users').delete().eq('clerk_id', event.data.id)
  }

  return new Response('OK', { status: 200 })
}
