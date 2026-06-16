import { NextRequest } from 'next/server'
import { z } from 'zod'
import { err, ok } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import {
  buildPaddleTransactionPayload,
  buildShowrunnerCheckoutUrl,
  getPaddlePriceIdForPlan,
  resolvePaddleConfig,
} from '@/lib/billing/paddle'

const CheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro']),
})

type PaddleTransactionResponse = {
  data?: {
    id?: string
    checkout?: { url?: string }
  }
  id?: string
  checkout?: { url?: string }
}

// POST /api/subscription/checkout — create a Paddle hosted checkout transaction
export async function POST(req: NextRequest) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const body = await req.json().catch(() => null)
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', '请选择有效套餐')

  const config = resolvePaddleConfig()
  if (!config.apiKey) {
    return err('INTERNAL_ERROR', 'Paddle API key is not configured')
  }
  if (!config.clientToken) {
    return err('INTERNAL_ERROR', 'Paddle client token is not configured')
  }

  const priceId = getPaddlePriceIdForPlan(parsed.data.plan, config)
  if (!priceId) {
    return err('INTERNAL_ERROR', `Paddle price is not configured for ${parsed.data.plan}`)
  }

  const paddleRes = await fetch(`${config.apiBaseUrl}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildPaddleTransactionPayload({
      plan: parsed.data.plan,
      priceId,
      user,
    })),
  }).catch(error => {
    console.error('[paddle] checkout request failed:', error)
    return null
  })

  if (!paddleRes) {
    return err('PAYMENT_PROVIDER_ERROR', '无法创建 Paddle 结账，请稍后重试')
  }

  if (!paddleRes.ok) {
    const detail = await paddleRes.text().catch(() => '')
    console.error(`[paddle] checkout API error ${paddleRes.status}: ${detail.slice(0, 500)}`)
    return err('PAYMENT_PROVIDER_ERROR', '无法创建 Paddle 结账，请稍后重试')
  }

  const payload = await paddleRes.json() as PaddleTransactionResponse
  const transaction = payload.data ?? payload
  if (!transaction.id) {
    console.error('[paddle] checkout API response missing transaction id')
    return err('PAYMENT_PROVIDER_ERROR', '无法创建 Paddle 结账，请稍后重试')
  }

  return ok({
    checkout_url: buildShowrunnerCheckoutUrl(req.url, transaction.id),
    transaction_id: transaction.id,
  })
}
