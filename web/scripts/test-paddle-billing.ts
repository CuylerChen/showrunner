import assert from 'node:assert/strict'
import {
  buildPaddleTransactionPayload,
  getPlanLimit,
  resolvePaddleConfig,
  resolvePaddlePlanFromEvent,
  signPaddleWebhookPayload,
  verifyPaddleWebhookSignature,
} from '../src/lib/billing/paddle'

const env = {
  PADDLE_ENVIRONMENT: 'sandbox',
  PADDLE_API_KEY: 'test-api-key',
  PADDLE_WEBHOOK_SECRET: 'test-secret',
  PADDLE_STARTER_PRICE_ID: 'pri_starter',
  PADDLE_PRO_PRICE_ID: 'pri_pro',
} as NodeJS.ProcessEnv

assert.equal(getPlanLimit('free'), 3)
assert.equal(getPlanLimit('starter'), 10)
assert.equal(getPlanLimit('pro'), -1)

const config = resolvePaddleConfig(env)
assert.equal(config.apiBaseUrl, 'https://sandbox-api.paddle.com')
assert.equal(config.priceIds.starter, 'pri_starter')

const payload = buildPaddleTransactionPayload({
  plan: 'starter',
  priceId: 'pri_starter',
  user: { id: 'user_1', email: 'user@example.com' },
})
assert.deepEqual(payload.items, [{ price_id: 'pri_starter', quantity: 1 }])
assert.equal(payload.collection_mode, 'automatic')
assert.equal(payload.customer_email, 'user@example.com')
assert.deepEqual(payload.custom_data, { user_id: 'user_1', plan: 'starter' })

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
assert.equal(
  resolvePaddlePlanFromEvent({ custom_data: {}, items: [{ price: { id: 'pri_starter' } }] }, config),
  'starter',
)

console.log('paddle billing tests passed')
