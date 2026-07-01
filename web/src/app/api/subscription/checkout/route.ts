import { NextRequest } from 'next/server'
import { z } from 'zod'
import { err, ok } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import {
  buildCreemCheckoutPayload,
  buildShowrunnerBillingReturnUrl,
  getCreemProductIdForPlan,
  resolveCreemConfig,
} from '@/lib/billing/creem'

const CheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro']),
})

type CreemCheckoutResponse = {
  id?: string
  checkout_url?: string
}

// POST /api/subscription/checkout — create a Creem hosted checkout
export async function POST(req: NextRequest) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const body = await req.json().catch(() => null)
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', '请选择有效套餐')

  const config = resolveCreemConfig()
  if (!config.apiKey) {
    return err('INTERNAL_ERROR', 'Creem API key is not configured')
  }

  const productId = getCreemProductIdForPlan(parsed.data.plan, config)
  if (!productId) {
    return err('INTERNAL_ERROR', `Creem product is not configured for ${parsed.data.plan}`)
  }

  const checkoutRes = await fetch(`${config.apiBaseUrl}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildCreemCheckoutPayload({
      plan: parsed.data.plan,
      productId,
      user,
      successUrl: buildShowrunnerBillingReturnUrl(req.url, 'success'),
      requestId: `user_${user.id}:${parsed.data.plan}:${crypto.randomUUID()}`,
    })),
  }).catch(error => {
    console.error('[creem] checkout request failed:', error)
    return null
  })

  if (!checkoutRes) {
    return err('PAYMENT_PROVIDER_ERROR', '无法创建 Creem 结账，请稍后重试')
  }

  if (!checkoutRes.ok) {
    const detail = await checkoutRes.text().catch(() => '')
    console.error(`[creem] checkout API error ${checkoutRes.status}: ${detail.slice(0, 500)}`)
    return err('PAYMENT_PROVIDER_ERROR', '无法创建 Creem 结账，请稍后重试')
  }

  const checkout = await checkoutRes.json() as CreemCheckoutResponse
  if (!checkout.id || !checkout.checkout_url) {
    console.error('[creem] checkout API response missing checkout id or URL')
    return err('PAYMENT_PROVIDER_ERROR', '无法创建 Creem 结账，请稍后重试')
  }

  return ok({
    checkout_url: checkout.checkout_url,
    transaction_id: checkout.id,
    checkout_id: checkout.id,
  })
}
