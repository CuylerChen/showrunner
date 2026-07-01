import assert from 'node:assert/strict'
import {
  buildCreemCheckoutPayload,
  buildShowrunnerBillingReturnUrl,
  getCreemProductIdForPlan,
  getPlanLimit,
  isShowrunnerCreemEvent,
  mapCreemSubscriptionStatus,
  resolveCreemConfig,
  resolveCreemPlanFromEvent,
  signCreemWebhookPayload,
  verifyCreemWebhookSignature,
} from '../src/lib/billing/creem'

const env = {
  CREEM_API_KEY: 'creem_test_key',
  CREEM_API_BASE_URL: 'https://custom.creem.test/',
  CREEM_WEBHOOK_SECRET: 'test-secret',
  CREEM_STARTER_PRODUCT_ID: 'prod_starter',
  CREEM_PRO_PRODUCT_ID: 'prod_pro',
}

assert.equal(getPlanLimit('free'), 1)
assert.equal(getPlanLimit('starter'), 10)
assert.equal(getPlanLimit('pro'), -1)

const config = resolveCreemConfig(env)
assert.equal(config.apiBaseUrl, 'https://custom.creem.test')
assert.equal(config.productIds.starter, 'prod_starter')
assert.equal(config.productIds.pro, 'prod_pro')
assert.equal(getCreemProductIdForPlan('starter', config), 'prod_starter')
assert.equal(getCreemProductIdForPlan('pro', config), 'prod_pro')
assert.equal(getCreemProductIdForPlan('starter', { ...config, productIds: { ...config.productIds, starter: '' } }), null)
assert.equal(resolveCreemConfig({ CREEM_API_KEY: 'creem_test_123' }).apiBaseUrl, 'https://test-api.creem.io')
assert.equal(resolveCreemConfig({ CREEM_API_KEY: 'creem_live_123' }).apiBaseUrl, 'https://api.creem.io')

const payload = buildCreemCheckoutPayload({
  plan: 'starter',
  productId: 'prod_starter',
  user: { id: 'user_1', email: 'buyer@example.com' },
  successUrl: 'https://showrunner.cuylerchen.uk/dashboard?billing=success',
  requestId: 'req_1',
})
assert.equal(payload.product_id, 'prod_starter')
assert.equal(payload.units, 1)
assert.deepEqual(payload.customer, { email: 'buyer@example.com' })
assert.equal(payload.success_url, 'https://showrunner.cuylerchen.uk/dashboard?billing=success')
assert.deepEqual(payload.metadata, { app: 'showrunner', user_id: 'user_1', plan: 'starter' })
assert.equal(
  buildShowrunnerBillingReturnUrl('https://localhost:3100/api/subscription/checkout', 'success', 'https://showrunner.cuylerchen.uk'),
  'https://showrunner.cuylerchen.uk/dashboard?billing=success',
)

const rawBody = JSON.stringify({ id: 'evt_1' })
const signature = signCreemWebhookPayload(rawBody, 'test-secret')
assert.equal(verifyCreemWebhookSignature(rawBody, signature, 'test-secret'), true)
assert.equal(verifyCreemWebhookSignature(`${rawBody}x`, signature, 'test-secret'), false)
assert.equal(verifyCreemWebhookSignature(rawBody, `bad, ${signature}`, 'test-secret'), true)

assert.equal(resolveCreemPlanFromEvent({ metadata: { plan: 'pro' }, items: [] }, config), 'pro')
assert.equal(resolveCreemPlanFromEvent({ metadata: { app: 'gigacoder', plan: 'pro' }, items: [] }, config), null)
assert.equal(resolveCreemPlanFromEvent({ metadata: {}, product: { id: 'prod_starter' } }, config), 'starter')
assert.equal(resolveCreemPlanFromEvent({ metadata: {}, items: [{ product_id: 'prod_pro' }] }, config), 'pro')
assert.equal(isShowrunnerCreemEvent({ metadata: { app: 'showrunner', plan: 'pro' }, items: [] }, config), true)
assert.equal(isShowrunnerCreemEvent({ metadata: { app: 'gigacoder', plan: 'pro' }, items: [] }, config), false)
assert.equal(isShowrunnerCreemEvent({ metadata: {}, product: 'prod_starter' }, config), true)

assert.deepEqual(mapCreemSubscriptionStatus('active'), { localStatus: 'active', resetToFree: false })
assert.deepEqual(mapCreemSubscriptionStatus('trialing'), { localStatus: 'active', resetToFree: false })
assert.deepEqual(mapCreemSubscriptionStatus('scheduled_cancel'), { localStatus: 'active', resetToFree: false })
assert.deepEqual(mapCreemSubscriptionStatus('paused'), { localStatus: 'cancelled', resetToFree: true })
assert.deepEqual(mapCreemSubscriptionStatus('past_due'), { localStatus: 'expired', resetToFree: true })
assert.deepEqual(mapCreemSubscriptionStatus('active', 'subscription.expired'), { localStatus: 'expired', resetToFree: true })
assert.deepEqual(mapCreemSubscriptionStatus('unknown'), null)

console.log('creem billing tests passed')
