import assert from 'node:assert/strict'
import {
  buildPaddlePortalSessionPayload,
  resolvePaddlePortalLinks,
} from '../src/lib/billing/paddle'

assert.deepEqual(
  buildPaddlePortalSessionPayload('sub_123'),
  { subscription_ids: ['sub_123'] },
)

assert.deepEqual(
  buildPaddlePortalSessionPayload(null),
  {},
)

const links = resolvePaddlePortalLinks({
  data: {
    urls: {
      general: { overview: 'https://portal.paddle.com/overview' },
      subscriptions: [
        {
          id: 'sub_123',
          cancel_subscription: 'https://portal.paddle.com/cancel',
          update_subscription_payment_method: 'https://portal.paddle.com/payment',
        },
      ],
    },
  },
}, 'sub_123')

assert.equal(links.portalUrl, 'https://portal.paddle.com/overview')
assert.equal(links.cancelUrl, 'https://portal.paddle.com/cancel')
assert.equal(links.updatePaymentMethodUrl, 'https://portal.paddle.com/payment')

assert.deepEqual(resolvePaddlePortalLinks({}, 'sub_123'), {
  portalUrl: null,
  cancelUrl: null,
  updatePaymentMethodUrl: null,
})

console.log('paddle portal tests passed')
