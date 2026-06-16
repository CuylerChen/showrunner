import assert from 'node:assert/strict'
import {
  buildPaddleTransactionPayload,
  buildShowrunnerCheckoutUrl,
  getPlanLimit,
  getPaddlePriceIdForPlan,
  isShowrunnerPaddleEvent,
  mapPaddleSubscriptionStatus,
  resolvePaddleConfig,
  resolvePaddlePlanFromEvent,
  signPaddleWebhookPayload,
  verifyPaddleWebhookSignature,
} from '../src/lib/billing/paddle'

const env = {
  PADDLE_ENVIRONMENT: 'sandbox',
  PADDLE_API_KEY: 'test-api-key',
  PADDLE_CLIENT_TOKEN: 'test-client-token',
  PADDLE_WEBHOOK_SECRET: 'test-secret',
  PADDLE_STARTER_PRICE_ID: 'pri_starter',
  PADDLE_PRO_PRICE_ID: 'pri_pro',
}

assert.equal(getPlanLimit('free'), 1)
assert.equal(getPlanLimit('starter'), 10)
assert.equal(getPlanLimit('pro'), -1)

const config = resolvePaddleConfig(env)
assert.equal(config.apiBaseUrl, 'https://sandbox-api.paddle.com')
assert.equal(config.clientToken, 'test-client-token')
assert.equal(config.priceIds.starter, 'pri_starter')
assert.equal(config.priceIds.pro, 'pri_pro')
assert.equal(getPaddlePriceIdForPlan('starter', config), 'pri_starter')
assert.equal(getPaddlePriceIdForPlan('pro', config), 'pri_pro')
assert.equal(getPaddlePriceIdForPlan('starter', { ...config, priceIds: { ...config.priceIds, starter: '' } }), null)
assert.equal(resolvePaddleConfig({ PADDLE_ENVIRONMENT: 'production' }).apiBaseUrl, 'https://api.paddle.com')
assert.equal(resolvePaddleConfig({ PADDLE_ENVIRONMENT: 'live' }).apiBaseUrl, 'https://api.paddle.com')
assert.deepEqual(
  resolvePaddleConfig({
    PADDLE_PRICE_ID: 'legacy_single_price',
    PADDLE_STARTER_PRICE_ID: 'pri_starter',
    PADDLE_PRO_PRICE_ID: 'pri_pro',
  }).priceIds,
  { starter: 'pri_starter', pro: 'pri_pro' },
  'Starter and Pro must use separate Paddle price ids',
)
assert.deepEqual(
  resolvePaddleConfig({ PADDLE_PRICE_ID: 'legacy_single_price' }).priceIds,
  { starter: '', pro: '' },
  'A single legacy Paddle price id must not be reused for both paid plans',
)

const payload = buildPaddleTransactionPayload({
  plan: 'starter',
  priceId: 'pri_starter',
  user: { id: 'user_1' },
})
assert.deepEqual(payload.items, [{ price_id: 'pri_starter', quantity: 1 }])
assert.equal(payload.collection_mode, 'automatic')
assert.deepEqual(payload.custom_data, { app: 'showrunner', user_id: 'user_1', plan: 'starter' })
assert.equal('customer_email' in payload, false)
assert.equal(
  buildShowrunnerCheckoutUrl('https://showrunner.cuylerchen.uk/api/subscription/checkout', 'txn_123'),
  'https://showrunner.cuylerchen.uk/paddle-checkout?_ptxn=txn_123',
)

const rawBody = JSON.stringify({ event_id: 'evt_1' })
const timestamp = 1770883200
const signature = signPaddleWebhookPayload(rawBody, timestamp, 'test-secret')
assert.equal(
  verifyPaddleWebhookSignature(rawBody, `ts=${timestamp};h1=${signature}`, 'test-secret', {
    nowMs: timestamp * 1000,
  }),
  true,
)
assert.equal(
  verifyPaddleWebhookSignature(`${rawBody}x`, `ts=${timestamp};h1=${signature}`, 'test-secret', {
    nowMs: timestamp * 1000,
  }),
  false,
)

assert.equal(resolvePaddlePlanFromEvent({ custom_data: { plan: 'pro' }, items: [] }, config), 'pro')
assert.equal(resolvePaddlePlanFromEvent({ custom_data: { app: 'gigacoder', plan: 'pro' }, items: [] }, config), null)
assert.equal(
  resolvePaddlePlanFromEvent({ custom_data: {}, items: [{ price: { id: 'pri_starter' } }] }, config),
  'starter',
)
assert.equal(isShowrunnerPaddleEvent({ custom_data: { app: 'showrunner', plan: 'pro' }, items: [] }, config), true)
assert.equal(isShowrunnerPaddleEvent({ custom_data: { app: 'gigacoder', plan: 'pro' }, items: [] }, config), false)
assert.equal(isShowrunnerPaddleEvent({ custom_data: {}, items: [{ price: { id: 'pri_starter' } }] }, config), true)

assert.deepEqual(mapPaddleSubscriptionStatus('active'), { localStatus: 'active', resetToFree: false })
assert.deepEqual(mapPaddleSubscriptionStatus('trialing'), { localStatus: 'active', resetToFree: false })
assert.deepEqual(mapPaddleSubscriptionStatus('paused'), { localStatus: 'cancelled', resetToFree: true })
assert.deepEqual(mapPaddleSubscriptionStatus('past_due'), { localStatus: 'expired', resetToFree: true })
assert.deepEqual(mapPaddleSubscriptionStatus('canceled'), { localStatus: 'cancelled', resetToFree: true })
assert.deepEqual(mapPaddleSubscriptionStatus('unknown'), null)

console.log('paddle billing tests passed')
