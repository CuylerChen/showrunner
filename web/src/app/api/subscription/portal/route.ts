import { err, ok } from '@/lib/api'
import { getCurrentUser, getSubscription } from '@/lib/auth'
import {
  buildCreemCustomerBillingPayload,
  resolveCreemConfig,
  resolveCreemCustomerBillingLinks,
} from '@/lib/billing/creem'

type CreemCustomerBillingResponse = Parameters<typeof resolveCreemCustomerBillingLinks>[0]

export async function POST() {
  const { user, response } = await getCurrentUser()
  if (!user) return response!

  const subscription = await getSubscription(user.id)
  if (!subscription) return err('SUBSCRIPTION_NOT_FOUND', '订阅信息不存在')
  if (!subscription.creem_customer_id) {
    return err('SUBSCRIPTION_PORTAL_UNAVAILABLE', '当前套餐暂未关联 Creem 订阅，无法打开订阅管理')
  }

  const config = resolveCreemConfig()
  if (!config.apiKey) {
    return err('INTERNAL_ERROR', 'Creem API key is not configured')
  }

  const billingRes = await fetch(
    `${config.apiBaseUrl}/v1/customers/billing`,
    {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildCreemCustomerBillingPayload(subscription.creem_customer_id)),
    },
  ).catch(error => {
    console.error('[creem] customer billing request failed:', error)
    return null
  })

  if (!billingRes) {
    return err('PAYMENT_PROVIDER_ERROR', '无法打开 Creem 订阅管理，请稍后重试')
  }

  if (!billingRes.ok) {
    const detail = await billingRes.text().catch(() => '')
    console.error(`[creem] customer billing API error ${billingRes.status}: ${detail.slice(0, 500)}`)
    return err('PAYMENT_PROVIDER_ERROR', '无法打开 Creem 订阅管理，请稍后重试')
  }

  const payload = await billingRes.json() as CreemCustomerBillingResponse
  const links = resolveCreemCustomerBillingLinks(payload)
  if (!links.portalUrl) {
    console.error('[creem] customer billing API response missing portal link')
    return err('PAYMENT_PROVIDER_ERROR', '无法打开 Creem 订阅管理，请稍后重试')
  }

  return ok({
    portal_url: links.portalUrl,
    cancel_url: links.portalUrl,
    update_payment_method_url: links.portalUrl,
  })
}
