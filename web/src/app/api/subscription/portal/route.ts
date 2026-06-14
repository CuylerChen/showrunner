import { err, ok } from '@/lib/api'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import {
  buildPaddlePortalSessionPayload,
  resolvePaddleConfig,
  resolvePaddlePortalLinks,
} from '@/lib/billing/paddle'

type PaddlePortalSessionResponse = Parameters<typeof resolvePaddlePortalLinks>[0]

export async function POST() {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const subscription = await getSubscription(user.id)
  if (!subscription) return err('SUBSCRIPTION_NOT_FOUND', '订阅信息不存在')
  if (!subscription.paddle_customer_id || !subscription.paddle_subscription_id) {
    return err('SUBSCRIPTION_PORTAL_UNAVAILABLE', '当前套餐暂未关联 Paddle 订阅，无法打开订阅管理')
  }

  const config = resolvePaddleConfig()
  if (!config.apiKey) {
    return err('INTERNAL_ERROR', 'Paddle API key is not configured')
  }

  const paddleRes = await fetch(
    `${config.apiBaseUrl}/customers/${encodeURIComponent(subscription.paddle_customer_id)}/portal-sessions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPaddlePortalSessionPayload(subscription.paddle_subscription_id)),
    },
  ).catch(error => {
    console.error('[paddle] portal session request failed:', error)
    return null
  })

  if (!paddleRes) {
    return err('PAYMENT_PROVIDER_ERROR', '无法打开 Paddle 订阅管理，请稍后重试')
  }

  if (!paddleRes.ok) {
    const detail = await paddleRes.text().catch(() => '')
    console.error(`[paddle] portal session API error ${paddleRes.status}: ${detail.slice(0, 500)}`)
    return err('PAYMENT_PROVIDER_ERROR', '无法打开 Paddle 订阅管理，请稍后重试')
  }

  const payload = await paddleRes.json() as PaddlePortalSessionResponse
  const links = resolvePaddlePortalLinks(payload, subscription.paddle_subscription_id)
  if (!links.portalUrl && !links.cancelUrl) {
    console.error('[paddle] portal session API response missing portal links')
    return err('PAYMENT_PROVIDER_ERROR', '无法打开 Paddle 订阅管理，请稍后重试')
  }

  return ok({
    portal_url: links.portalUrl,
    cancel_url: links.cancelUrl,
    update_payment_method_url: links.updatePaymentMethodUrl,
  })
}
