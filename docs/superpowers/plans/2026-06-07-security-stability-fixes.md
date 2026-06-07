# Security Stability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the current Showrunner MVP against the reviewed security and stability issues without expanding the product surface.

**Architecture:** Add focused guard utilities for URL safety and ownership checks, wire them into existing route and worker boundaries, then update vulnerable dependencies. Keep unsupported billing and legacy login-state generation paths visibly out of the main workflow.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM with MySQL, BullMQ, Node 22 worker, Playwright, TypeScript, npm scripts.

---

## File Structure

- Create `web/src/lib/security/safe-url.ts`: URL syntax, hostname, and IP-range validation for web API input.
- Create `web/scripts/test-safe-url.ts`: fast pure tests for web URL guard helpers.
- Modify `web/package.json`: add `test:security`, update patched dependencies.
- Modify `web/package-lock.json`: lock updated dependencies.
- Create `worker/src/utils/safe-url.ts`: worker URL validation plus safe redirect resolution for fetch and browser navigation.
- Create `worker/scripts/test-safe-url.ts`: fast pure tests for worker URL guard helpers.
- Modify `worker/package.json`: add `test:security`, update patched dependencies.
- Modify `worker/package-lock.json`: lock updated dependencies.
- Create `web/src/lib/demo-owner.ts`: reusable current-user demo ownership helper.
- Modify `web/src/app/api/demos/[id]/login-session/route.ts`: enforce ownership and validate start URL.
- Modify `web/src/app/api/demos/[id]/login-session/input/route.ts`: enforce ownership and validate navigation events.
- Modify `web/src/app/api/demos/[id]/login-session/save/route.ts`: enforce ownership on read and update.
- Modify `web/src/app/api/demos/[id]/login-session/screenshot/route.ts`: enforce ownership.
- Modify `web/src/lib/jwt.ts`: production secret validation.
- Modify `web/src/app/api/auth/oauth/google/route.ts`: graceful missing config handling.
- Modify `web/src/app/api/auth/oauth/github/route.ts`: graceful missing config handling.
- Modify `web/src/app/api/demos/route.ts`: safe URL validation, atomic quota reservation, queue failure rollback, quota message consistency.
- Modify `worker/src/services/parser/index.ts`: safe fetch with manual redirect validation.
- Modify `worker/src/services/parser/assets.ts`: safe screenshot URL resolution.
- Modify `worker/src/services/browser-session/index.ts`: validate start and navigation URLs.
- Modify `web/src/components/demo/demo-card.tsx`: hide unsupported session controls from main UI.
- Modify `web/src/locales/zh.ts` and `web/src/locales/en.ts`: soften quota and login-session copy if still referenced.
- Modify `web/src/app/api/demos/[id]/status/route.ts`: avoid double-close in SSE stream.

---

### Task 1: Update Dependencies and Add Security Test Scripts

**Files:**
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Modify: `worker/package.json`
- Modify: `worker/package-lock.json`

- [ ] **Step 1: Update web dependency ranges**

Set `web/package.json` versions:

```json
{
  "dependencies": {
    "bullmq": "^5.77.0",
    "drizzle-orm": "^0.45.2",
    "next": "16.2.7"
  },
  "devDependencies": {
    "eslint-config-next": "16.2.7"
  }
}
```

Also add:

```json
{
  "scripts": {
    "test:security": "tsx scripts/test-safe-url.ts"
  },
  "devDependencies": {
    "tsx": "^4.21.0"
  }
}
```

- [ ] **Step 2: Update worker dependency ranges**

Set `worker/package.json` versions:

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.995.0",
    "bullmq": "^5.77.0",
    "drizzle-orm": "^0.45.2",
    "playwright": "^1.58.2"
  },
  "scripts": {
    "test:security": "npx tsx scripts/test-safe-url.ts"
  }
}
```

- [ ] **Step 3: Install dependencies with project-local cache**

Run:

```bash
npm install --cache /private/tmp/showrunner-npm-cache
```

from `web/`.

Expected: exit 0 and `package-lock.json` updated.

Run:

```bash
npm install --cache /private/tmp/showrunner-worker-npm-cache
```

from `worker/`.

Expected: exit 0 and `package-lock.json` updated.

- [ ] **Step 4: Run quick build checks**

Run:

```bash
npm run lint
npm run build
```

from `web/`.

Run:

```bash
npm run build
```

from `worker/`.

Expected: all commands exit 0. If Drizzle type changes break compilation, adjust imports and result typing in the later implementation tasks.

- [ ] **Step 5: Commit dependency baseline**

Run:

```bash
git add web/package.json web/package-lock.json worker/package.json worker/package-lock.json
git commit -m "chore: update vulnerable dependencies"
```

---

### Task 2: Add URL Safety Guards

**Files:**
- Create: `web/src/lib/security/safe-url.ts`
- Create: `web/scripts/test-safe-url.ts`
- Create: `worker/src/utils/safe-url.ts`
- Create: `worker/scripts/test-safe-url.ts`

- [ ] **Step 1: Write web URL guard tests first**

Create `web/scripts/test-safe-url.ts`:

```typescript
import assert from 'node:assert/strict'
import {
  isBlockedIpAddress,
  parseHttpUrl,
  validateUrlForUserInput,
} from '../src/lib/security/safe-url'

assert.equal(isBlockedIpAddress('127.0.0.1'), true)
assert.equal(isBlockedIpAddress('10.0.0.8'), true)
assert.equal(isBlockedIpAddress('172.16.0.1'), true)
assert.equal(isBlockedIpAddress('192.168.1.20'), true)
assert.equal(isBlockedIpAddress('169.254.169.254'), true)
assert.equal(isBlockedIpAddress('8.8.8.8'), false)
assert.equal(isBlockedIpAddress('::1'), true)

assert.equal(parseHttpUrl('https://example.com/path')?.href, 'https://example.com/path')
assert.equal(parseHttpUrl('ftp://example.com'), null)
assert.equal(parseHttpUrl('https://user:pass@example.com'), null)
assert.equal(validateUrlForUserInput('http://127.0.0.1:3000').ok, false)
assert.equal(validateUrlForUserInput('https://example.com').ok, true)

console.log('web safe-url tests passed')
```

- [ ] **Step 2: Run web URL guard tests to verify they fail**

Run:

```bash
npm run test:security
```

from `web/`.

Expected: FAIL because `web/src/lib/security/safe-url.ts` does not exist.

- [ ] **Step 3: Implement web URL guard**

Create `web/src/lib/security/safe-url.ts`:

```typescript
import dns from 'node:dns/promises'
import net from 'node:net'

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; message: string }

function inRange(value: number, start: number, end: number) {
  return value >= start && value <= end
}

function ipv4ToNumber(ip: string) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

export function isBlockedIpAddress(address: string): boolean {
  const version = net.isIP(address)
  if (version === 4) {
    const n = ipv4ToNumber(address)
    return (
      inRange(n, ipv4ToNumber('0.0.0.0'), ipv4ToNumber('0.255.255.255')) ||
      inRange(n, ipv4ToNumber('10.0.0.0'), ipv4ToNumber('10.255.255.255')) ||
      inRange(n, ipv4ToNumber('127.0.0.0'), ipv4ToNumber('127.255.255.255')) ||
      inRange(n, ipv4ToNumber('169.254.0.0'), ipv4ToNumber('169.254.255.255')) ||
      inRange(n, ipv4ToNumber('172.16.0.0'), ipv4ToNumber('172.31.255.255')) ||
      inRange(n, ipv4ToNumber('192.168.0.0'), ipv4ToNumber('192.168.255.255')) ||
      inRange(n, ipv4ToNumber('224.0.0.0'), ipv4ToNumber('239.255.255.255')) ||
      address === '169.254.169.254'
    )
  }
  if (version === 6) {
    const lower = address.toLowerCase()
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')
  }
  return false
}

export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (!url.hostname) return null
    return url
  } catch {
    return null
  }
}

export function validateUrlForUserInput(raw: string): UrlValidationResult {
  const url = parseHttpUrl(raw)
  if (!url) return { ok: false, message: '请输入有效的 http(s) URL，且不要包含用户名或密码' }
  if (net.isIP(url.hostname) && isBlockedIpAddress(url.hostname)) {
    return { ok: false, message: '不支持内网、本机或云 metadata 地址' }
  }
  return { ok: true, url }
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  const parsed = validateUrlForUserInput(raw)
  if (!parsed.ok) throw new Error(parsed.message)

  const records = await dns.lookup(parsed.url.hostname, { all: true, verbatim: true })
  if (!records.length) throw new Error('无法解析目标域名')
  if (records.some(record => isBlockedIpAddress(record.address))) {
    throw new Error('目标域名解析到不允许访问的地址')
  }
  return parsed.url
}
```

- [ ] **Step 4: Write worker URL guard tests first**

Create `worker/scripts/test-safe-url.ts`:

```typescript
import assert from 'node:assert/strict'
import {
  isBlockedIpAddress,
  parseHttpUrl,
  validateUrlForUserInput,
} from '../src/utils/safe-url'

assert.equal(isBlockedIpAddress('127.0.0.1'), true)
assert.equal(isBlockedIpAddress('10.1.2.3'), true)
assert.equal(isBlockedIpAddress('172.31.255.255'), true)
assert.equal(isBlockedIpAddress('192.168.0.1'), true)
assert.equal(isBlockedIpAddress('169.254.169.254'), true)
assert.equal(isBlockedIpAddress('1.1.1.1'), false)
assert.equal(isBlockedIpAddress('::1'), true)

assert.equal(parseHttpUrl('https://example.com')?.hostname, 'example.com')
assert.equal(parseHttpUrl('file:///etc/passwd'), null)
assert.equal(parseHttpUrl('https://user@example.com'), null)
assert.equal(validateUrlForUserInput('http://localhost').ok, true)
assert.equal(validateUrlForUserInput('http://127.0.0.1').ok, false)

console.log('worker safe-url tests passed')
```

- [ ] **Step 5: Run worker URL guard tests to verify they fail**

Run:

```bash
npm run test:security
```

from `worker/`.

Expected: FAIL because `worker/src/utils/safe-url.ts` does not exist.

- [ ] **Step 6: Implement worker URL guard**

Create `worker/src/utils/safe-url.ts` with the same pure helpers as the web file, plus redirect resolution:

```typescript
import dns from 'node:dns/promises'
import net from 'node:net'

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; message: string }

function inRange(value: number, start: number, end: number) {
  return value >= start && value <= end
}

function ipv4ToNumber(ip: string) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

export function isBlockedIpAddress(address: string): boolean {
  const version = net.isIP(address)
  if (version === 4) {
    const n = ipv4ToNumber(address)
    return (
      inRange(n, ipv4ToNumber('0.0.0.0'), ipv4ToNumber('0.255.255.255')) ||
      inRange(n, ipv4ToNumber('10.0.0.0'), ipv4ToNumber('10.255.255.255')) ||
      inRange(n, ipv4ToNumber('127.0.0.0'), ipv4ToNumber('127.255.255.255')) ||
      inRange(n, ipv4ToNumber('169.254.0.0'), ipv4ToNumber('169.254.255.255')) ||
      inRange(n, ipv4ToNumber('172.16.0.0'), ipv4ToNumber('172.31.255.255')) ||
      inRange(n, ipv4ToNumber('192.168.0.0'), ipv4ToNumber('192.168.255.255')) ||
      inRange(n, ipv4ToNumber('224.0.0.0'), ipv4ToNumber('239.255.255.255')) ||
      address === '169.254.169.254'
    )
  }
  if (version === 6) {
    const lower = address.toLowerCase()
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')
  }
  return false
}

export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (!url.hostname) return null
    return url
  } catch {
    return null
  }
}

export function validateUrlForUserInput(raw: string): UrlValidationResult {
  const url = parseHttpUrl(raw)
  if (!url) return { ok: false, message: 'Only http(s) URLs without credentials are allowed' }
  if (net.isIP(url.hostname) && isBlockedIpAddress(url.hostname)) {
    return { ok: false, message: 'Private, loopback, link-local, multicast, and metadata addresses are not allowed' }
  }
  return { ok: true, url }
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  const parsed = validateUrlForUserInput(raw)
  if (!parsed.ok) throw new Error(parsed.message)

  const records = await dns.lookup(parsed.url.hostname, { all: true, verbatim: true })
  if (!records.length) throw new Error('Hostname could not be resolved')
  if (records.some(record => isBlockedIpAddress(record.address))) {
    throw new Error('Hostname resolves to a blocked address')
  }
  return parsed.url
}

export async function resolveSafeRedirectUrl(raw: string, fetchImpl: typeof fetch = fetch): Promise<URL> {
  let current = await assertSafePublicUrl(raw)
  for (let i = 0; i < 5; i++) {
    const response = await fetchImpl(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShowrunnerPromoBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return current
    const location = response.headers.get('location')
    if (!location) return current
    current = await assertSafePublicUrl(new URL(location, current).toString())
  }
  throw new Error('Too many redirects')
}
```

- [ ] **Step 7: Run URL guard tests**

Run:

```bash
npm run test:security
```

from `web/` and from `worker/`.

Expected: both exit 0.

- [ ] **Step 8: Commit URL guards**

Run:

```bash
git add web/src/lib/security/safe-url.ts web/scripts/test-safe-url.ts web/package.json worker/src/utils/safe-url.ts worker/scripts/test-safe-url.ts worker/package.json
git commit -m "feat: add safe url guards"
```

---

### Task 3: Wire URL Guards Into Web and Worker Boundaries

**Files:**
- Modify: `web/src/app/api/demos/route.ts`
- Modify: `web/src/app/api/demos/[id]/login-session/route.ts`
- Modify: `web/src/app/api/demos/[id]/login-session/input/route.ts`
- Modify: `worker/src/services/parser/index.ts`
- Modify: `worker/src/services/parser/assets.ts`
- Modify: `worker/src/services/browser-session/index.ts`

- [ ] **Step 1: Validate demo creation URLs in web API**

In `web/src/app/api/demos/route.ts`, import:

```typescript
import { assertSafePublicUrl } from '@/lib/security/safe-url'
```

After parsing the body and before quota reservation, add:

```typescript
let safeProductUrl: URL
try {
  safeProductUrl = await assertSafePublicUrl(product_url)
  if (normalizedCtaUrl) await assertSafePublicUrl(normalizedCtaUrl)
} catch (validationError) {
  return err('VALIDATION_ERROR', (validationError as Error).message)
}
```

Use `safeProductUrl.toString()` for stored and queued `product_url`.

- [ ] **Step 2: Validate login-session start URL**

In `web/src/app/api/demos/[id]/login-session/route.ts`, import:

```typescript
import { assertSafePublicUrl } from '@/lib/security/safe-url'
```

Before forwarding `POST`, validate `body.url`:

```typescript
const safeUrl = await assertSafePublicUrl(String(body.url ?? ''))
body.url = safeUrl.toString()
```

Return JSON 422 on validation failure:

```typescript
return Response.json({ success: false, error: (e as Error).message }, { status: 422 })
```

- [ ] **Step 3: Validate login-session navigation events**

In `web/src/app/api/demos/[id]/login-session/input/route.ts`, import:

```typescript
import { assertSafePublicUrl } from '@/lib/security/safe-url'
```

Before forwarding:

```typescript
if (body?.type === 'navigate') {
  try {
    const safeUrl = await assertSafePublicUrl(String(body.url ?? ''))
    body.url = safeUrl.toString()
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 422 })
  }
}
```

- [ ] **Step 4: Use safe fetch in parser**

In `worker/src/services/parser/index.ts`, import:

```typescript
import { assertSafePublicUrl, resolveSafeRedirectUrl } from '../../utils/safe-url'
```

At the start of `analyzePublicWebsite`, replace raw input with:

```typescript
const safeHome = await resolveSafeRedirectUrl(productUrl)
const homeHtml = await fetchHtml(safeHome.toString())
const urls = Array.from(new Set([safeHome.toString(), ...extractLinks(homeHtml, safeHome.toString())])).slice(0, MAX_PAGES)
```

In `fetchHtml`, add:

```typescript
const safeUrl = await assertSafePublicUrl(url)
const resp = await fetch(safeUrl, { redirect: 'manual', ... })
if ([301, 302, 303, 307, 308].includes(resp.status)) {
  const location = resp.headers.get('location')
  if (!location) throw new Error('网页重定向缺少 Location')
  return fetchHtml(new URL(location, safeUrl).toString())
}
```

- [ ] **Step 5: Use safe redirect resolution for screenshots**

In `worker/src/services/parser/assets.ts`, import:

```typescript
import { resolveSafeRedirectUrl, assertSafePublicUrl } from '../../utils/safe-url'
```

Before `page.goto`, resolve the URL:

```typescript
const safeUrl = await resolveSafeRedirectUrl(url)
await page.goto(safeUrl.toString(), { waitUntil: 'networkidle', timeout: 20000 })
await assertSafePublicUrl(page.url())
```

- [ ] **Step 6: Validate worker browser-session URLs**

In `worker/src/services/browser-session/index.ts`, import:

```typescript
import { assertSafePublicUrl } from '../../utils/safe-url'
```

At the start of `startSession`:

```typescript
const safeUrl = await assertSafePublicUrl(url)
```

Use `safeUrl.toString()` for `page.goto`.

In `handleInput` for `navigate`:

```typescript
const safeUrl = await assertSafePublicUrl(event.url)
await session.page.goto(safeUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
```

- [ ] **Step 7: Run builds and URL tests**

Run:

```bash
npm run test:security
npm run lint
npm run build
```

from `web/`.

Run:

```bash
npm run test:security
npm run build
```

from `worker/`.

Expected: all commands exit 0.

- [ ] **Step 8: Commit URL wiring**

Run:

```bash
git add web/src/app/api/demos/route.ts web/src/app/api/demos/[id]/login-session/route.ts web/src/app/api/demos/[id]/login-session/input/route.ts worker/src/services/parser/index.ts worker/src/services/parser/assets.ts worker/src/services/browser-session/index.ts
git commit -m "fix: enforce safe urls at network boundaries"
```

---

### Task 4: Enforce Demo Ownership on Login-Session APIs

**Files:**
- Create: `web/src/lib/demo-owner.ts`
- Modify: `web/src/app/api/demos/[id]/login-session/route.ts`
- Modify: `web/src/app/api/demos/[id]/login-session/input/route.ts`
- Modify: `web/src/app/api/demos/[id]/login-session/save/route.ts`
- Modify: `web/src/app/api/demos/[id]/login-session/screenshot/route.ts`

- [ ] **Step 1: Create ownership helper**

Create `web/src/lib/demo-owner.ts`:

```typescript
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export async function findOwnedDemo(userId: string, demoId: string) {
  return db
    .select({
      id: schema.demos.id,
      product_url: schema.demos.product_url,
      description: schema.demos.description,
    })
    .from(schema.demos)
    .where(and(eq(schema.demos.id, demoId), eq(schema.demos.user_id, userId)))
    .then(rows => rows[0] ?? null)
}

export function forbiddenDemoResponse() {
  return Response.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Demo 不存在或无权访问' } },
    { status: 404 },
  )
}
```

- [ ] **Step 2: Use helper in login-session route**

In `web/src/app/api/demos/[id]/login-session/route.ts`, replace `getUserId()` usage with:

```typescript
const userId = await getUserId()
if (!userId) return Response.json({ success: false }, { status: 401 })
const demo = await findOwnedDemo(userId, id)
if (!demo) return forbiddenDemoResponse()
```

Apply this to `POST`, `GET`, and `DELETE`.

- [ ] **Step 3: Use helper in input route**

In `web/src/app/api/demos/[id]/login-session/input/route.ts`, after reading `id`, add:

```typescript
const demo = await findOwnedDemo(userId, id)
if (!demo) return forbiddenDemoResponse()
```

- [ ] **Step 4: Use helper in screenshot route**

In `web/src/app/api/demos/[id]/login-session/screenshot/route.ts`, after reading `id`, add:

```typescript
const demo = await findOwnedDemo(userId, id)
if (!demo) return new Response('Session not found', { status: 404 })
```

- [ ] **Step 5: Fix save route ownership**

In `web/src/app/api/demos/[id]/login-session/save/route.ts`, replace the unscoped query:

```typescript
.where(eq(schema.demos.id, id))
```

with:

```typescript
.where(and(eq(schema.demos.id, id), eq(schema.demos.user_id, userId)))
```

Also replace the update condition with the same `and(...)` expression.

- [ ] **Step 6: Run web checks**

Run:

```bash
npm run lint
npm run build
```

from `web/`.

Expected: both exit 0.

- [ ] **Step 7: Commit ownership fix**

Run:

```bash
git add web/src/lib/demo-owner.ts web/src/app/api/demos/[id]/login-session/route.ts web/src/app/api/demos/[id]/login-session/input/route.ts web/src/app/api/demos/[id]/login-session/save/route.ts web/src/app/api/demos/[id]/login-session/screenshot/route.ts
git commit -m "fix: enforce demo ownership on login sessions"
```

---

### Task 5: Harden JWT, OAuth, Quota, and Queue Failure Behavior

**Files:**
- Modify: `web/src/lib/jwt.ts`
- Modify: `web/src/app/api/auth/oauth/google/route.ts`
- Modify: `web/src/app/api/auth/oauth/github/route.ts`
- Modify: `web/src/app/api/demos/route.ts`

- [ ] **Step 1: Require production JWT secret**

In `web/src/lib/jwt.ts`, replace the constant secret with:

```typescript
function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction && (!secret || secret === 'dev-secret-change-in-production' || secret.startsWith('change_this'))) {
    throw new Error('JWT_SECRET must be configured in production')
  }
  return new TextEncoder().encode(secret ?? 'dev-secret-change-in-production')
}

const JWT_SECRET = getJwtSecret()
```

- [ ] **Step 2: Make OAuth provider config fail gracefully**

In each OAuth route, before building `URLSearchParams`, add:

```typescript
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  return NextResponse.redirect(`${appUrl}/sign-in?error=oauth_not_configured`)
}
```

Use GitHub env names in the GitHub route.

Add `oauth_not_configured` to both locale files with:

```typescript
oauth_not_configured: 'OAuth 登录尚未配置，请使用邮箱登录。',
```

and English:

```typescript
oauth_not_configured: 'OAuth sign-in is not configured. Please use email sign-in.',
```

- [ ] **Step 3: Make quota reservation atomic**

In `web/src/app/api/demos/route.ts`, import `or` and `gt`:

```typescript
import { eq, and, desc, sql, or, gt } from 'drizzle-orm'
```

Replace the pre-read quota check with an atomic update:

```typescript
const reserved = await db
  .update(schema.subscriptions)
  .set({
    demos_used_this_month: sql`CASE WHEN ${schema.subscriptions.demos_limit} = -1 THEN ${schema.subscriptions.demos_used_this_month} ELSE ${schema.subscriptions.demos_used_this_month} + 1 END`,
  })
  .where(and(
    eq(schema.subscriptions.user_id, user.id),
    or(
      eq(schema.subscriptions.demos_limit, -1),
      sql`${schema.subscriptions.demos_used_this_month} < ${schema.subscriptions.demos_limit}`,
    ),
  ))
```

Check affected rows:

```typescript
const reservedRows = (reserved[0] as UpdateResult | undefined)?.affectedRows ?? 0
if (reservedRows === 0) {
  return err('QUOTA_EXCEEDED', '本月免费额度已用完。当前版本暂不支持自助升级，请联系管理员增加额度。')
}
```

- [ ] **Step 4: Roll back quota on insert or enqueue failure**

Add helper inside `POST`:

```typescript
async function releaseQuota() {
  await db
    .update(schema.subscriptions)
    .set({
      demos_used_this_month: sql`GREATEST(${schema.subscriptions.demos_used_this_month} - 1, 0)`,
    })
    .where(and(
      eq(schema.subscriptions.user_id, user.id),
      gt(schema.subscriptions.demos_limit, -1),
    ))
}
```

Wrap demo insert and enqueue:

```typescript
try {
  await db.insert(schema.demos).values({ ... })
  await parseQueue.add('parse', { ... }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
} catch (queueError) {
  await db.delete(schema.demos).where(eq(schema.demos.id, demoId)).catch(() => undefined)
  await releaseQuota()
  return err('INTERNAL_ERROR', `创建任务失败: ${(queueError as Error).message}`)
}
```

- [ ] **Step 5: Run web checks**

Run:

```bash
npm run lint
npm run build
```

from `web/`.

Expected: both exit 0.

- [ ] **Step 6: Commit auth and quota hardening**

Run:

```bash
git add web/src/lib/jwt.ts web/src/app/api/auth/oauth/google/route.ts web/src/app/api/auth/oauth/github/route.ts web/src/app/api/demos/route.ts web/src/locales/zh.ts web/src/locales/en.ts
git commit -m "fix: harden auth config and quota reservation"
```

---

### Task 6: Align Unsupported Product Paths and SSE Stability

**Files:**
- Modify: `web/src/components/demo/demo-card.tsx`
- Modify: `web/src/locales/zh.ts`
- Modify: `web/src/locales/en.ts`
- Modify: `web/src/app/api/demos/[id]/status/route.ts`

- [ ] **Step 1: Hide session controls from main demo cards**

In `web/src/components/demo/demo-card.tsx`, replace:

```typescript
const showSessionBtn = status === 'review' || status === 'paused'
```

with:

```typescript
const showSessionBtn = false
```

Keep `SessionPanel` code for compatibility but do not surface it.

- [ ] **Step 2: Soften stale login-session copy**

In `web/src/locales/zh.ts`, change session copy that says generation will use credentials to:

```typescript
hasSession: '登录凭证已保存（旧录制流程兼容）',
```

In `web/src/locales/en.ts`, change it to:

```typescript
hasSession: 'Login credentials saved for legacy recording compatibility.',
```

- [ ] **Step 3: Add safe SSE close helper**

In `web/src/app/api/demos/[id]/status/route.ts`, inside `start(controller)`, add:

```typescript
let closed = false
function closeStream() {
  if (closed) return
  closed = true
  clearInterval(interval)
  controller.close()
}
```

Because `interval` is defined later, implement it as:

```typescript
let closed = false
let interval: ReturnType<typeof setInterval>
function closeStream() {
  if (closed) return
  closed = true
  if (interval) clearInterval(interval)
  controller.close()
}
interval = setInterval(async () => { ... }, 2000)
```

Replace every `clearInterval(interval); controller.close()` with `closeStream()`.

- [ ] **Step 4: Run web checks**

Run:

```bash
npm run lint
npm run build
```

from `web/`.

Expected: both exit 0.

- [ ] **Step 5: Commit product consistency and SSE fix**

Run:

```bash
git add web/src/components/demo/demo-card.tsx web/src/locales/zh.ts web/src/locales/en.ts web/src/app/api/demos/[id]/status/route.ts
git commit -m "fix: align unsupported flows and stabilize sse"
```

---

### Task 7: Final Verification and Audit

**Files:**
- No source edits unless verification reveals a concrete issue.

- [ ] **Step 1: Run full web verification**

Run:

```bash
npm run test:security
npm run lint
npm run build
npm audit --audit-level=moderate --cache /private/tmp/showrunner-npm-cache
```

from `web/`.

Expected: tests, lint, and build exit 0. Audit should exit 0, or any remaining findings must be listed with package, severity, and reason they remain.

- [ ] **Step 2: Run full worker verification**

Run:

```bash
npm run test:security
npm run build
npm audit --audit-level=moderate --cache /private/tmp/showrunner-worker-npm-cache
```

from `worker/`.

Expected: tests and build exit 0. Audit should exit 0, or any remaining findings must be listed with package, severity, and reason they remain.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intentional source, package, and plan changes remain if final commit has not been created.

- [ ] **Step 4: Final commit if needed**

If uncommitted verification fixes remain, run:

```bash
git add .
git commit -m "fix: complete security stability hardening"
```

- [ ] **Step 5: Summarize final state**

Report:
- Commands run and exit status.
- Any audit findings left.
- Commits created.
- Any intentionally deferred scope such as full paid checkout or full legacy recorder restoration.

---

## Self-Review

Spec coverage:
- Dependency upgrades are covered by Task 1 and Task 7.
- URL safety is covered by Tasks 2 and 3.
- Login-session ownership is covered by Task 4.
- JWT and OAuth config are covered by Task 5.
- Quota and queue consistency are covered by Task 5.
- Payment and login-state UI consistency are covered by Task 6.
- SSE close stability is covered by Task 6.
- Verification is covered by Task 7.

Completeness scan:
- The plan contains no unresolved markers or unspecified implementation steps.

Type consistency:
- `validateUrlForUserInput`, `parseHttpUrl`, `isBlockedIpAddress`, and `assertSafePublicUrl` names match across tests and implementations.
- `findOwnedDemo` and `forbiddenDemoResponse` are introduced before route usage.
