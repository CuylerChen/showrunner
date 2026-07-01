# Creem Integration Points

Date: 2026-07-01

This note maps the current Creem usage after moving subscription billing from Paddle to Creem.

## Current Creem Usage

Creem is integrated for both content moderation and subscription billing.

- `web/src/lib/moderation/creem.ts`
  - Resolves `CREEM_API_BASE_URL`, defaulting to `https://test-api.creem.io` for `creem_test_` keys and `https://api.creem.io` otherwise.
  - Calls `POST /v1/moderation/prompt` with `x-api-key`.
  - Normalizes app-facing failures into `PROMPT_REJECTED`, `CONTENT_MODERATION_NOT_CONFIGURED`, and `CONTENT_MODERATION_UNAVAILABLE`.
  - Provides prompt composers for demo creation and scene text.
- Protected generation entry points:
  - `web/src/app/api/demos/route.ts`
  - `web/src/app/api/demos/[id]/login-session/save/route.ts`
  - `web/src/app/api/demos/[id]/steps/route.ts`
  - `web/src/app/api/demos/[id]/start/route.ts`
  - `web/src/app/api/demos/[id]/steps/[stepId]/resolve/route.ts`
- Billing entry points:
  - `web/src/lib/billing/creem.ts`
  - `web/src/app/api/subscription/checkout/route.ts`
  - `web/src/app/api/subscription/portal/route.ts`
  - `web/src/app/api/webhooks/creem/route.ts`
- Config:
  - `web/.env.local.example` includes `CREEM_API_KEY`, `CREEM_API_BASE_URL`, `CREEM_MODERATION_TIMEOUT_MS`, `CREEM_WEBHOOK_SECRET`, `CREEM_STARTER_PRODUCT_ID`, and `CREEM_PRO_PRODUCT_ID`.
- Tests:
  - `web/scripts/test-creem-billing.ts`
  - `web/scripts/test-creem-portal.ts`
  - `web/scripts/test-creem-webhook-idempotency.ts`
  - `web/scripts/test-creem-moderation-compliance.ts`
  - `web/scripts/test-creem-legal-copy.ts`
- Legal copy:
  - `web/src/locales/en.ts`
  - `web/src/locales/zh.ts`
  - `web/src/components/legal-page.tsx`

The active checkout, portal, webhook, schema, deployment config, legal copy, and tests now use Creem. Historical Paddle migration/design notes remain under `docs/superpowers/`.

## Creem Billing Entry Points

The app keeps provider-neutral subscription routes and routes those calls to Creem.

### Server Billing Module

Current billing file:

- `web/src/lib/billing/creem.ts`

The Creem helper owns:

- API base URL resolution: production `https://api.creem.io`, test `https://test-api.creem.io`.
- Env parsing:
  - `CREEM_API_KEY`
  - `CREEM_API_BASE_URL` as an optional override for local tests or proxies
  - `CREEM_WEBHOOK_SECRET`
  - `CREEM_STARTER_PRODUCT_ID`
  - `CREEM_PRO_PRODUCT_ID`
- Plan helpers:
  - `AppPlan`, `PaidPlan`, `getPlanLimit`, and `isPaidPlan` live in provider-neutral `web/src/lib/plans.ts`.
- Checkout payload builder:
  - Creem checkout uses `product_id`, optional `request_id`, optional `customer`, `success_url`, and `metadata`.
  - Metadata should include at least `app: "showrunner"`, `user_id`, and `plan`.
- Webhook helpers:
  - Verify `creem-signature` over the raw request body using HMAC-SHA256 and `CREEM_WEBHOOK_SECRET`, or use `@creem_io/nextjs` / `creem/webhooks`.
  - Parse `eventType` and `object`.
  - Map Creem product IDs or metadata plan values back to `starter` / `pro`.

### Checkout API

Current route:

- `web/src/app/api/subscription/checkout/route.ts`

Creem flow:

- Keep the app route and request shape: `POST /api/subscription/checkout` with `{ "plan": "starter" | "pro" }`.
- Replace Paddle `POST /transactions` with Creem `POST /v1/checkouts`.
- Use server-side product ID lookup from `CREEM_STARTER_PRODUCT_ID` / `CREEM_PRO_PRODUCT_ID`.
- Include `customer.email` when available and metadata for `user_id` and `plan`.
- Return Creem `checkout_url` directly.

The old `/paddle-checkout` bridge was removed because Creem checkout creation returns a redirect URL.

### Checkout Bridge Page

The Paddle JS bridge files were deleted:

- `web/src/app/paddle-checkout/page.tsx`
- `web/src/components/subscription/paddle-checkout-client.tsx`

`web/src/proxy.ts` now exposes `/api/webhooks/creem` and no longer exposes `/paddle-checkout`.

### Webhook API

Current route:

- `web/src/app/api/webhooks/creem/route.ts`

Implemented behavior:

- Public route in `web/src/proxy.ts`.
- Read raw body before JSON parsing.
- Verify `creem-signature`.
- Insert event ID into a Creem idempotency table before mutating subscription state.
- Resolve target user by metadata `user_id`; fallback to existing `creem_subscription_id` when present.
- Process subscription lifecycle events:
  - `checkout.completed`: useful for initial customer/subscription metadata capture.
  - `subscription.paid`, `subscription.active`, `subscription.trialing`, `subscription.update`: active paid access.
  - `subscription.scheduled_cancel`: keep access active until current period end, but preserve provider status.
  - `subscription.canceled`, `subscription.expired`, `subscription.paused`, `subscription.past_due`: revoke or downgrade according to product policy.
  - `refund.created`, `dispute.created`: log and optionally revoke depending on policy.

Creem docs recommend returning HTTP 200 after successful receipt, and their retry schedule depends on non-200 responses.

### Customer Portal

Current route:

- `web/src/app/api/subscription/portal/route.ts`

Creem flow:

- Replace Paddle customer portal sessions with `POST /v1/customers/billing`.
- Request body needs `customer_id`.
- Response returns `customer_portal_link`.
- The existing dashboard buttons can keep calling `/api/subscription/portal`; only the route implementation and returned field mapping need to change.

### Database Schema

Current Creem-specific fields:

- `web/src/lib/db/schema.ts`
- `database/schema.sql`
- `database/migrations/20260701_creem_billing.sql`

Current columns:

- `creem_customer_id`
- `creem_subscription_id`
- `creem_product_id`
- `creem_status`
- `creem_updated_at`
- table `creem_events`

Provider-neutral alternative:

- Add `billing_provider`, `provider_customer_id`, `provider_subscription_id`, `provider_product_id`, `provider_status`, `provider_updated_at`, and a generic `billing_events` table.
- This is cleaner long term but requires more careful migration from existing Paddle fields.

### Dashboard/UI

Current files:

- `web/src/components/subscription/upgrade-panel.tsx`
- `web/src/app/(dashboard)/dashboard/page.tsx`
- `web/src/locales/en.ts`
- `web/src/locales/zh.ts`
- `web/src/components/pricing-section.tsx`

Implemented changes:

- Replace user-facing Paddle strings in subscription errors and checkout status with Creem.
- Keep pricing cards and dashboard upgrade buttons mostly unchanged.
- Keep `/api/subscription/checkout` and `/api/subscription/portal` as stable app APIs so the frontend does not need provider-specific branching.

### Deployment Config And Tests

Creem references are wired through deployment config and guard tests:

- `web/.env.local.example`
- `scripts/setup-bare.sh`
- `scripts/test-bare-deploy-config.mjs`
- `docs/bare-metal-deploy.md`
- `docs/vps-deploy.md`
- `docs/database-schema.md`
- `docs/api-design.md`
- `docs/system-architecture.md`
- `docs/product-decisions.md`
- `docker-compose.yml`
- `ecosystem.config.cjs`
- `web/package.json`
- `web/scripts/test-creem-billing.ts`
- `web/scripts/test-creem-portal.ts`
- `web/scripts/test-creem-webhook-idempotency.ts`

These are included in `web/package.json` under `test:security`.

## Suggested Migration Order

1. Extract provider-neutral plan helpers out of Paddle billing code. Done.
2. Add Creem billing pure helpers and tests. Done.
3. Add Creem schema columns and `creem_events`. Done.
4. Implement `/api/subscription/checkout` against Creem while preserving the existing app API response shape. Done.
5. Implement `/api/webhooks/creem`, add it to `proxy.ts`, and test signature/idempotency/status mapping. Done.
6. Switch `/api/subscription/portal` to Creem customer billing links. Done.
7. Remove `/paddle-checkout` bridge and Paddle JS component. Done.
8. Update env examples, deployment scripts, docs, locale copy, and tests. Done.
9. Run `cd web && npm run test:security` and `cd web && npm run build`.

## External References Checked

- Creem API base URLs and `x-api-key` authentication: https://docs.creem.io/api-reference/introduction
- Creem checkout creation: https://docs.creem.io/api-reference/endpoint/create-checkout
- Creem webhook signature and event types: https://docs.creem.io/code/webhooks
- Creem customer portal links: https://docs.creem.io/api-reference/endpoint/create-customer-billing
- Creem prompt moderation: https://docs.creem.io/api-reference/endpoint/screen-prompt
