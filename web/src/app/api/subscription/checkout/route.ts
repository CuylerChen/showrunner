import { NextRequest } from 'next/server'
import { z } from 'zod'
import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

const PLAN_VARIANT: Record<string, string> = {
  starter: process.env.LEMONSQUEEZY_STARTER_VARIANT_ID ?? '',
  pro:     process.env.LEMONSQUEEZY_PRO_VARIANT_ID     ?? '',
}

lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY ?? '' })

const CheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro']),
})

// POST /api/subscription/checkout — 创建 LemonSqueezy 结账链接
export async function POST(req: NextRequest) {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const body = await req.json().catch(() => null)
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', '套餐参数无效')

  const variantId = PLAN_VARIANT[parsed.data.plan]
  if (!variantId) return err('INTERNAL_ERROR', '套餐配置缺失，请联系管理员')

  const storeId = process.env.LEMONSQUEEZY_STORE_ID ?? ''

  const { data, error } = await createCheckout(storeId, variantId, {
    checkoutData: {
      email: user.email,
      custom: { user_id: user.id },
    },
    checkoutOptions: {
      embed:         true,
      media:         false,
      logo:          true,
      buttonColor:   '#000000',
    },
    productOptions: {
      redirectUrl:    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      receiptLinkUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    },
  })

  if (error || !data) return err('INTERNAL_ERROR', '创建结账链接失败，请稍后重试')

  return ok({ checkout_url: data.data?.attributes?.url })
}
