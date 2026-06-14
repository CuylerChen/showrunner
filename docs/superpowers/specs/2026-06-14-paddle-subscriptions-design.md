# Showrunner Paddle Subscriptions Design

Date: 2026-06-14
Status: Approved for implementation planning

## Goal

Replace the removed LemonSqueezy checkout/webhook routes with a Paddle Billing subscription flow that lets authenticated users upgrade from the local free plan to Starter or Pro, then keeps local subscription quota in sync from Paddle webhooks.

## Product Scope

This pass implements the paid subscription foundation only.

In scope:

- Server-side Paddle checkout creation for `starter` and `pro`.
- Paddle webhook signature verification and idempotent event handling.
- Local subscription updates for active, trialing, paused, past due, canceled, and expired subscription states.
- Plan limits aligned with the existing product model: `free = 1`, `starter = 10`, `pro = -1`.
- Minimal UI and API copy so quota exhaustion can send users to a real checkout path.
- Environment configuration for Paddle without Docker-specific deployment changes.
- Focused tests for plan mapping, checkout request construction, webhook signature verification, and webhook subscription updates.

Out of scope:

- Customer portal sessions.
- Proration or plan change management from inside Showrunner.
- Coupons, trials, tax settings, invoices, refunds, chargebacks, or one-time add-ons.
- Team billing or seat-based billing.
- Analytics beyond the existing local view count.

## Paddle Integration Model

Use Paddle Billing, not Paddle Classic.

Checkout is created on the server with `POST /transactions` and `collection_mode = automatic`. Paddle documents that automatically collected transactions are for self-serve checkout, and a returned `checkout.url` can be used to collect payment. The transaction body uses catalog `price_id` items and `custom_data` to carry the local `user_id` and requested plan.

The local checkout endpoint returns:

```json
{
  "success": true,
  "data": {
    "checkout_url": "https://checkout.paddle.com/...",
    "transaction_id": "txn_..."
  }
}
```

The frontend opens the hosted checkout URL in the current browser tab. This is deliberately simpler than embedding Paddle.js during this pass and avoids adding client-side token setup.

## Environment

Add these variables to `.env.example` and the target runtime environment:

```bash
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_STARTER_PRICE_ID=
PADDLE_PRO_PRICE_ID=
```

`PADDLE_ENVIRONMENT` accepts `sandbox` or `production`.

API base URL:

- `sandbox`: `https://sandbox-api.paddle.com`
- `production`: `https://api.paddle.com`

The checkout URL returned to the browser always comes from Paddle's created transaction response.

## Data Model

Extend `subscriptions`:

- `paddle_customer_id varchar(64) null`
- `paddle_subscription_id varchar(64) null unique`
- `paddle_price_id varchar(64) null`
- `paddle_status varchar(40) null`
- `paddle_updated_at timestamp null`

Create `paddle_events`:

- `id varchar(64) primary key`
- `event_type varchar(80) not null`
- `occurred_at timestamp null`
- `processed_at timestamp not null default current_timestamp`

The `paddle_events` table is the idempotency boundary. If the same event ID is received again, the webhook returns success without mutating subscription rows again.

The local `subscriptions.status` remains the app-facing status:

- Paddle `active` or `trialing` -> local `active`
- Paddle `paused` -> local `cancelled`
- Paddle `past_due` -> local `expired`
- Paddle `canceled` or `cancelled` -> local `cancelled`

Unknown statuses do not change the plan; they update Paddle metadata only and return success to avoid webhook retry storms.

## Checkout API

Route: `POST /api/subscription/checkout`

Request:

```json
{
  "plan": "starter"
}
```

Validation:

- Requires authenticated user.
- `plan` must be `starter` or `pro`.
- The requested plan must have a configured Paddle price ID.
- `PADDLE_API_KEY` must be configured.

Paddle request:

```json
{
  "items": [
    {
      "price_id": "pri_...",
      "quantity": 1
    }
  ],
  "collection_mode": "automatic",
  "custom_data": {
    "user_id": "local-user-id",
    "plan": "starter"
  }
}
```

The local app returns Paddle's response `data.checkout.url` to the browser.

Failure behavior:

- Paddle config missing: `500 INTERNAL_ERROR`
- Paddle API failure: `502` response with generic user-facing message and server-side log detail.
- Unsupported plan: `422 VALIDATION_ERROR`

## Webhook API

Route: `POST /api/webhooks/paddle`

The route reads the raw request body and verifies the `Paddle-Signature` header. Paddle documents the header format as `ts=<unix timestamp>;h1=<signature>`, and the signed payload is `<timestamp>:<raw body>` hashed with HMAC SHA256 using the webhook secret.

Accepted event types for this pass:

- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.cancelled`
- `subscription.paused`
- `subscription.resumed`
- `subscription.past_due`

Subscription lookup order:

1. `custom_data.user_id`
2. existing `subscriptions.paddle_subscription_id`
3. no match -> return success and log a warning

Plan resolution order:

1. `custom_data.plan` when it is `starter` or `pro`
2. first known `items[].price.id` or `items[].price_id` matching configured Starter or Pro price IDs
3. no match -> keep existing plan and update Paddle metadata only

When a known active/trialing subscription event is processed, update:

- `plan`
- `status`
- `demos_limit`
- Paddle metadata fields
- `current_period_end` from Paddle `current_billing_period.ends_at` when present

When a canceled/expired event is processed, set:

- `plan = free`
- `status = cancelled` or `expired`
- `demos_limit = 1`
- Paddle metadata fields retained for audit

## UI Behavior

Add a small upgrade action where quota information is already shown or where quota errors surface. The UI should call `/api/subscription/checkout` and redirect the browser to `checkout_url`.

No pricing table redesign is required in this pass. The minimum acceptable UI is:

- Free users who are out of quota can click "Upgrade to Starter".
- Users can choose Starter or Pro from compact buttons.
- API errors are shown with the existing app error styling.

## Security

- Paddle checkout creation is server-side so price IDs and local user association cannot be changed from browser code.
- Webhooks require signature verification before parsing event JSON.
- Signature comparison uses constant-time comparison.
- Webhook processing is idempotent by event ID.
- Paddle webhook route is public in middleware but validates signatures itself.
- User input never controls `price_id`; plan names map to environment-configured price IDs.

## Testing

Add focused script tests without introducing a new test runner:

- Plan mapping returns the correct local limit and rejects unsupported plans.
- Checkout payload construction includes price ID, quantity, collection mode, email, and custom data.
- Webhook signature verifier accepts valid signatures and rejects modified bodies.
- Webhook event handler maps Paddle subscription states to local plan/status/limit decisions.

Required verification:

```bash
cd web && npm run test:security
cd web && npm run lint
cd web && npm run build
git status --short
```

## References

- Paddle Create Transaction API: https://developer.paddle.com/api-reference/transactions/create-transaction/
- Paddle webhook signature verification: https://developer.paddle.com/webhooks/about/signature-verification/
- Paddle Checkout open docs: https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/
