import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

const PLAN_LIMITS: Record<string, { plan: string; limit: number }> = {
  starter: { plan: 'starter', limit: 10  },
  pro:     { plan: 'pro',     limit: -1  },
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))
}

// POST /api/webhooks/lemonsqueezy — 订阅支付回调
export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook secret 未配置', { status: 500 })

  const body      = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  if (!verifySignature(body, signature, secret)) {
    return new Response('签名验证失败', { status: 400 })
  }

  const event    = JSON.parse(body)
  const type     = event.meta?.event_name as string
  const attrs    = event.data?.attributes ?? {}
  const userId   = event.meta?.custom_data?.user_id as string | undefined
  const lsId     = event.data?.id as string

  if (!userId) return new Response('缺少 user_id', { status: 400 })

  const supabase = createAdminClient()

  if (type === 'subscription_created') {
    const variantName = attrs.variant_name?.toLowerCase() ?? ''
    const planConfig  = PLAN_LIMITS[variantName] ?? PLAN_LIMITS.starter

    await supabase
      .from('subscriptions')
      .update({
        plan:               planConfig.plan,
        status:             'active',
        demos_limit:        planConfig.limit,
        lemon_squeezy_id:   lsId,
        current_period_end: attrs.renews_at,
      })
      .eq('user_id', userId)
  }

  if (type === 'subscription_updated') {
    const variantName = attrs.variant_name?.toLowerCase() ?? ''
    const planConfig  = PLAN_LIMITS[variantName] ?? PLAN_LIMITS.starter

    await supabase
      .from('subscriptions')
      .update({
        plan:               planConfig.plan,
        status:             attrs.status === 'active' ? 'active' : 'cancelled',
        demos_limit:        planConfig.limit,
        current_period_end: attrs.renews_at,
      })
      .eq('lemon_squeezy_id', lsId)
  }

  if (type === 'subscription_cancelled') {
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('lemon_squeezy_id', lsId)
  }

  if (type === 'subscription_expired') {
    await supabase
      .from('subscriptions')
      .update({ plan: 'free', status: 'expired', demos_limit: 1 })
      .eq('lemon_squeezy_id', lsId)
  }

  return new Response('OK', { status: 200 })
}
