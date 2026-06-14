# Paddle Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Paddle Billing checkout and webhooks so Showrunner users can upgrade to Starter or Pro and receive local quota updates.

**Architecture:** Keep Paddle logic in a small pure `web/src/lib/billing/paddle.ts` module, then wire it into Next.js API routes. Persist Paddle identifiers on `subscriptions`, dedupe webhooks through `paddle_events`, and expose a small dashboard upgrade panel that opens Paddle hosted checkout URLs.

**Tech Stack:** Next.js API routes, Drizzle MySQL schema, Paddle Billing REST API, Node `crypto`, TypeScript script tests, existing JWT auth and locale system.

---

## File Map

- Create `web/src/lib/billing/paddle.ts`: Paddle config, plan mapping, transaction payload builder, signature verification, and webhook decision helpers.
- Create `web/scripts/test-paddle-billing.ts`: script-level tests for pure billing behavior.
- Modify `web/package.json`: include Paddle billing tests in `test:security`.
- Modify `web/src/lib/api.ts`: add `PAYMENT_PROVIDER_ERROR` mapped to HTTP 502.
- Modify `web/src/lib/db/schema.ts`: add Paddle subscription fields and `paddle_events`.
- Modify `database/schema.sql`: add Paddle subscription fields and `paddle_events` for new environments.
- Create `database/migrations/20260614_paddle_subscriptions.sql`: idempotent migration for existing MySQL databases.
- Modify `web/src/app/api/subscription/checkout/route.ts`: create Paddle transactions and return hosted checkout URL.
- Create `web/src/app/api/webhooks/paddle/route.ts`: verify Paddle signatures and update local subscriptions idempotently.
- Modify `web/src/middleware.ts`: allow the public Paddle webhook route through middleware.
- Create `web/src/components/subscription/upgrade-panel.tsx`: compact client component for Starter/Pro checkout.
- Modify `web/src/app/(dashboard)/dashboard/page.tsx`: show current quota and upgrade panel.
- Modify `web/src/locales/zh.ts` and `web/src/locales/en.ts`: add subscription UI copy.
- Modify `.env.example`: add Paddle configuration. No Docker configuration is required for this pass.
- Modify `docs/api-design.md` and `docs/system-architecture.md`: replace LemonSqueezy subscription references with Paddle.

---

### Task 1: Paddle Pure Logic Tests

**Files:**
- Create: `web/scripts/test-paddle-billing.ts`
- Modify: `web/package.json`
- Create: `web/src/lib/billing/paddle.ts`

- [ ] **Step 1: Write the failing test**

Create `web/scripts/test-paddle-billing.ts` with assertions for:

```typescript
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
  user: { id: 'user_1' },
})
assert.deepEqual(payload.items, [{ price_id: 'pri_starter', quantity: 1 }])
assert.equal(payload.collection_mode, 'automatic')
assert.deepEqual(payload.custom_data, { user_id: 'user_1', plan: 'starter' })
assert.equal('customer_email' in payload, false)

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx tsx scripts/test-paddle-billing.ts`

Expected: FAIL because `../src/lib/billing/paddle` does not exist.

- [ ] **Step 3: Implement minimal pure billing module**

Create `web/src/lib/billing/paddle.ts` with exported functions used by the test. Use `crypto.createHmac('sha256', secret)` for signing and `crypto.timingSafeEqual` for comparing hex signatures.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx tsx scripts/test-paddle-billing.ts`

Expected: PASS with `paddle billing tests passed`.

- [ ] **Step 5: Add test to package script**

Modify `web/package.json`:

```json
"test:security": "tsx scripts/test-safe-url.ts && tsx scripts/test-db-errors.ts && tsx scripts/test-paddle-billing.ts"
```

- [ ] **Step 6: Run full web script checks**

Run: `cd web && npm run test:security`

Expected: PASS.

---

### Task 2: Database Schema

**Files:**
- Modify: `database/schema.sql`
- Create: `database/migrations/20260614_paddle_subscriptions.sql`
- Modify: `web/src/lib/db/schema.ts`

- [ ] **Step 1: Add Drizzle fields and table**

Extend `subscriptions` in `web/src/lib/db/schema.ts` with:

```typescript
paddle_customer_id:       varchar('paddle_customer_id', { length: 64 }),
paddle_subscription_id:   varchar('paddle_subscription_id', { length: 64 }),
paddle_price_id:          varchar('paddle_price_id', { length: 64 }),
paddle_status:            varchar('paddle_status', { length: 40 }),
paddle_updated_at:        timestamp('paddle_updated_at'),
```

Add:

```typescript
export const paddleEvents = mysqlTable('paddle_events', {
  id:           varchar('id', { length: 64 }).primaryKey(),
  event_type:   varchar('event_type', { length: 80 }).notNull(),
  occurred_at:  timestamp('occurred_at'),
  processed_at: timestamp('processed_at').defaultNow().notNull(),
})
```

- [ ] **Step 2: Update SQL schema**

Add the same subscription columns to `database/schema.sql` and create `paddle_events`.

- [ ] **Step 3: Add idempotent migration**

Create a MySQL migration that adds missing subscription columns through an `information_schema.COLUMNS` procedure and creates `paddle_events` if missing.

- [ ] **Step 4: Run build**

Run: `cd web && npm run lint`

Expected: PASS.

---

### Task 3: Checkout API

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/app/api/subscription/checkout/route.ts`

- [ ] **Step 1: Add 502 error code**

Add `PAYMENT_PROVIDER_ERROR` to `ErrorCode` and map it to `502`.

- [ ] **Step 2: Implement checkout route**

Replace the 404 route with:

- Auth via `getCurrentUser()`.
- Request validation with `z.object({ plan: z.enum(['starter', 'pro']) })`.
- Config resolution via `resolvePaddleConfig()`.
- Price ID lookup by requested plan.
- `fetch(`${config.apiBaseUrl}/transactions`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` } ... })`.
- Return `checkout_url` from `data.checkout.url` and `transaction_id` from `data.id`.

- [ ] **Step 3: Run lint and build**

Run:

```bash
cd web && npm run lint
cd web && npm run build
```

Expected: PASS.

---

### Task 4: Paddle Webhook API

**Files:**
- Create: `web/src/app/api/webhooks/paddle/route.ts`
- Modify: `web/src/middleware.ts`

- [ ] **Step 1: Add public middleware allowlist**

In `web/src/middleware.ts`, treat `/api/webhooks/paddle` as public. The route validates Paddle signatures itself.

- [ ] **Step 2: Implement webhook route**

The route must:

- Read `await req.text()` before parsing JSON.
- Verify `Paddle-Signature` with `verifyPaddleWebhookSignature`.
- Insert `event_id` into `paddle_events`; duplicate insert means return `{ success: true, data: { duplicate: true } }`.
- Resolve user by `event.data.custom_data.user_id`, then fallback to `event.data.id` matching `subscriptions.paddle_subscription_id`.
- Resolve plan from custom data or price IDs.
- Update `subscriptions` with local plan/status/limit and Paddle metadata.

- [ ] **Step 3: Run tests**

Run:

```bash
cd web && npm run test:security
cd web && npm run lint
```

Expected: PASS.

---

### Task 5: Upgrade UI and Copy

**Files:**
- Create: `web/src/components/subscription/upgrade-panel.tsx`
- Modify: `web/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `web/src/locales/zh.ts`
- Modify: `web/src/locales/en.ts`

- [ ] **Step 1: Build client upgrade panel**

Create a component that accepts current plan and usage, renders compact Starter/Pro buttons, posts to `/api/subscription/checkout`, and redirects to `checkout_url`.

- [ ] **Step 2: Render on dashboard**

Load subscription data on the dashboard server component and render the upgrade panel above `CreateForm`.

- [ ] **Step 3: Add locale keys**

Add matching `subscriptionPanel` keys to `zh.ts` and `en.ts`.

- [ ] **Step 4: Run lint/build**

Run:

```bash
cd web && npm run lint
cd web && npm run build
```

Expected: PASS.

---

### Task 6: Configuration and Documentation

**Files:**
- Modify: `.env.example`
- Modify: `docs/api-design.md`
- Modify: `docs/system-architecture.md`

- [ ] **Step 1: Add Paddle environment variables**

Add `PADDLE_ENVIRONMENT`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_STARTER_PRICE_ID`, and `PADDLE_PRO_PRICE_ID`.

- [ ] **Step 2: Update docs**

Replace LemonSqueezy subscription references with Paddle Billing checkout/webhook references.

- [ ] **Step 3: Final verification**

Run:

```bash
cd web && npm run test:security
cd web && npm run lint
cd web && npm run build
git status --short
```

Expected: tests and build pass. `git status --short` shows only intended Paddle files.

---

## Self-Review

- Spec coverage: checkout, webhook, schema, UI, env, docs, and verification are covered.
- Placeholder scan: no planned step contains unspecified implementation markers.
- Scope control: customer portal, coupons, proration, refunds, invoices, and plan changes are excluded from this pass.
