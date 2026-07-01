import assert from 'node:assert/strict'
import {
  buildCreemCustomerBillingPayload,
  resolveCreemCustomerBillingLinks,
} from '../src/lib/billing/creem'

assert.deepEqual(
  buildCreemCustomerBillingPayload('cust_123'),
  { customer_id: 'cust_123' },
)

assert.deepEqual(
  resolveCreemCustomerBillingLinks({
    customer_portal_link: 'https://creem.io/customer/billing/session',
  }),
  { portalUrl: 'https://creem.io/customer/billing/session' },
)

assert.deepEqual(resolveCreemCustomerBillingLinks({}), {
  portalUrl: null,
})

console.log('creem portal tests passed')
