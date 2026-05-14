# Marketing Video Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Showrunner's primary path from real product operation recording to automatic Product Story marketing video generation.

**Architecture:** Keep the current `web + worker + BullMQ + MySQL + HyperFrames` split. The main path becomes short-form marketing brief -> website analysis and screenshots -> AI scenes -> TTS -> HyperFrames promotional render; old recorder code remains temporarily unused.

**Tech Stack:** Next.js 16, React 19, Drizzle MySQL, BullMQ, Redis, Playwright, DeepSeek API, Kokoro TTS, HyperFrames, FFmpeg, R2/local video storage.

---

## File Structure

Modify these files:

- `supabase/schema.sql`: add marketing columns to `demos` and scene visual columns to `steps`.
- `web/src/lib/db/schema.ts`: keep Drizzle schema aligned with MySQL.
- `worker/src/utils/db.ts`: keep worker schema aligned with MySQL.
- `web/src/types/index.ts`: add marketing fields and scene visual fields to frontend types.
- `worker/src/types.ts`: add scene visual fields to worker `Step`.
- `web/src/app/api/demos/route.ts`: accept short-form marketing brief, validate it, save it, and enqueue parse.
- `web/src/app/api/demos/[id]/route.ts`: expose marketing fields and allow updating them.
- `web/src/app/api/demos/[id]/start/route.ts`: keep promotional render only and pass full scene payload.
- `web/src/app/api/demos/[id]/steps/route.ts`: update scene editing payload if needed.
- `worker/src/services/parser/index.ts`: split website analysis into reusable page text plus screenshot assets and generate Product Story scenes.
- `worker/src/workers/parse.worker.ts`: write scene visual metadata.
- `worker/src/services/hyperframes/index.ts`: upgrade promotional template to render screenshots, CTA, captions, and fallback visuals.
- `worker/src/workers/merge.worker.ts`: make promotional render the only marketing path and pass CTA/brand context into HyperFrames.
- `web/src/components/demo/create-form.tsx`: replace URL-only form with short marketing brief.
- `web/src/app/(dashboard)/demo/[id]/page.tsx`: present scenes, not operation steps; remove paused/manual-recording controls from main path.
- `web/src/app/share/[token]/page.tsx`: adjust labels to marketing video language where hard-coded.
- `web/src/locales/en.ts` and `web/src/locales/zh.ts`: update product copy.
- `docs/product-decisions.md`, `docs/system-architecture.md`, `docs/api-design.md`, `docs/hyperframes-refactor.md`: sync docs with marketing video direction.

Create these files:

- `worker/src/services/parser/assets.ts`: screenshot capture and local asset persistence for useful pages.
- `worker/src/services/parser/scenes.ts`: Product Story prompt, fallback scenes, and scene normalization.

---

### Task 1: Align Database Schema With Marketing Video Fields

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `web/src/lib/db/schema.ts`
- Modify: `worker/src/utils/db.ts`
- Modify: `web/src/types/index.ts`
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Add MySQL columns in `supabase/schema.sql`**

Add these columns to `demos` after `description`:

```sql
  audience      TEXT                                                                                    NULL,
  key_points    TEXT                                                                                    NULL,
  brand_tone    VARCHAR(80)                                                                             NULL,
  source_summary TEXT                                                                                   NULL,
  thumbnail_url TEXT                                                                                    NULL,
```

Add these columns to `steps` after `narration`:

```sql
  visual_type       ENUM('screenshot','template','cta')                                                     NOT NULL DEFAULT 'template',
  visual_asset_url  TEXT                                                                                    NULL,
```

Also add missing runtime columns to `demos` if they are not already present:

```sql
  view_count     INT                                                                                     NOT NULL DEFAULT 0,
  cta_url        TEXT                                                                                    NULL,
  cta_text       VARCHAR(100)                                                                            NULL,
  session_cookies TEXT                                                                                   NULL,
```

- [ ] **Step 2: Update `web/src/lib/db/schema.ts`**

Add imports only if needed; `text`, `varchar`, and `mysqlEnum` already exist. Update `demos`:

```ts
  audience:       text('audience'),
  key_points:     text('key_points'),
  brand_tone:     varchar('brand_tone', { length: 80 }),
  source_summary: text('source_summary'),
  thumbnail_url:  text('thumbnail_url'),
```

Update `steps`:

```ts
  visual_type:      mysqlEnum('visual_type', ['screenshot', 'template', 'cta']).default('template').notNull(),
  visual_asset_url: text('visual_asset_url'),
```

- [ ] **Step 3: Update `worker/src/utils/db.ts`**

Mirror the same fields in the worker's inline schema:

```ts
  audience:       text('audience'),
  key_points:     text('key_points'),
  brand_tone:     varchar('brand_tone', { length: 80 }),
  source_summary: text('source_summary'),
  thumbnail_url:  text('thumbnail_url'),
```

and:

```ts
  visual_type:      mysqlEnum('visual_type', ['screenshot', 'template', 'cta']).default('template').notNull(),
  visual_asset_url: text('visual_asset_url'),
```

- [ ] **Step 4: Update shared types**

In `worker/src/types.ts`, update `Step`:

```ts
export type VisualType = 'screenshot' | 'template' | 'cta'

export interface Step {
  id: string
  position: number
  title: string
  action_type: ActionType
  selector: string | null
  value: string | null
  narration: string | null
  wait_for_selector: string | null
  visual_type?: VisualType
  visual_asset_url?: string | null
  timestamp_start?: number
  timestamp_end?: number
}
```

In `web/src/types/index.ts`, add matching optional fields to `Demo` and `Step`:

```ts
export type VisualType = 'screenshot' | 'template' | 'cta'

export interface Step {
  id: string
  demo_id: string
  position: number
  title: string
  action_type: ActionType
  selector: string | null
  value: string | null
  narration: string | null
  wait_for_selector?: string | null
  visual_type?: VisualType
  visual_asset_url?: string | null
  timestamp_start: number | null
  timestamp_end: number | null
  status: StepStatus
}
```

Add these optional `Demo` fields:

```ts
  audience?: string | null
  key_points?: string | null
  brand_tone?: string | null
  source_summary?: string | null
  thumbnail_url?: string | null
  cta_text?: string | null
  cta_url?: string | null
```

- [ ] **Step 5: Run type/build checks for schema changes**

Run:

```bash
cd web && npm run lint
cd ../worker && npm run build
```

Expected:

- `web` lint completes without schema/type errors.
- `worker` TypeScript build completes without schema/type errors.

- [ ] **Step 6: Commit schema alignment**

```bash
git add supabase/schema.sql web/src/lib/db/schema.ts worker/src/utils/db.ts web/src/types/index.ts worker/src/types.ts
git commit -m "feat: add marketing video schema fields"
```

---

### Task 2: Accept Short-Form Marketing Brief in APIs

**Files:**
- Modify: `web/src/app/api/demos/route.ts`
- Modify: `web/src/app/api/demos/[id]/route.ts`
- Modify: `web/src/app/api/demos/[id]/start/route.ts`
- Modify: `web/src/app/api/demos/[id]/steps/route.ts`

- [ ] **Step 1: Extend create validation in `web/src/app/api/demos/route.ts`**

Replace `CreateDemoSchema` with:

```ts
const CreateDemoSchema = z.object({
  product_url: z.string().url('请输入有效的产品 URL'),
  description: z.string().max(500).nullable().optional(),
  audience: z.string().max(300).nullable().optional(),
  key_points: z.string().max(1000).nullable().optional(),
  brand_tone: z.string().max(80).nullable().optional(),
  cta_text: z.string().max(100).nullable().optional(),
  cta_url: z.string().url('请输入有效的 CTA URL').max(2048).nullable().optional().or(z.literal('')),
})
```

Normalize `cta_url` after parsing:

```ts
const {
  product_url,
  description,
  audience,
  key_points,
  brand_tone,
  cta_text,
  cta_url,
} = parsed.data

const normalizedCtaUrl = cta_url === '' ? null : cta_url ?? null
```

- [ ] **Step 2: Save short-form fields on create**

Update the insert values:

```ts
await db.insert(schema.demos).values({
  id: demoId,
  user_id: user.id,
  product_url,
  description: description ?? null,
  audience: audience ?? null,
  key_points: key_points ?? null,
  brand_tone: brand_tone ?? null,
  cta_text: cta_text ?? null,
  cta_url: normalizedCtaUrl,
  status: 'pending',
  share_token,
})
```

Update the parse queue payload:

```ts
await parseQueue.add('parse', {
  demoId,
  productUrl: product_url,
  description: description ?? null,
  audience: audience ?? null,
  keyPoints: key_points ?? null,
  brandTone: brand_tone ?? null,
  ctaText: cta_text ?? null,
  ctaUrl: normalizedCtaUrl,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
})
```

- [ ] **Step 3: Extend `PATCH /api/demos/[id]` validation**

In `web/src/app/api/demos/[id]/route.ts`, extend the patch schema:

```ts
const schema2 = z.object({
  title: z.string().min(1).max(100).optional(),
  audience: z.string().max(300).nullable().optional(),
  key_points: z.string().max(1000).nullable().optional(),
  brand_tone: z.string().max(80).nullable().optional(),
  cta_url: z.string().url().max(2048).nullable().optional(),
  cta_text: z.string().max(100).nullable().optional(),
}).refine(d => Object.keys(d).length > 0, { message: '至少提供一个更新字段' })
```

Then copy these keys into `updates` when present:

```ts
for (const key of ['title', 'audience', 'key_points', 'brand_tone', 'cta_url', 'cta_text'] as const) {
  if (parsed.data[key] !== undefined) updates[key] = parsed.data[key]
}
```

- [ ] **Step 4: Ensure start route is promotional-only**

In `web/src/app/api/demos/[id]/start/route.ts`, keep the current `renderMode: 'promotional'` and make the payload explicit:

```ts
await ttsQueue.add('tts', {
  demoId: id,
  steps,
  renderMode: 'promotional',
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
})
```

Remove any import or future use of `recordQueue` from this route.

- [ ] **Step 5: Update scene edit route**

Open `web/src/app/api/demos/[id]/steps/route.ts`. Ensure its update payload accepts only scene-safe fields:

```ts
const UpdateStepsSchema = z.object({
  steps: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int().min(1),
    title: z.string().min(1).max(255),
    narration: z.string().max(1000).nullable().optional(),
    visual_type: z.enum(['screenshot', 'template', 'cta']).optional(),
    visual_asset_url: z.string().max(2048).nullable().optional(),
  })).min(1),
})
```

For each step, update:

```ts
await db.update(schema.steps).set({
  position: step.position,
  title: step.title,
  narration: step.narration ?? null,
  visual_type: step.visual_type ?? 'template',
  visual_asset_url: step.visual_asset_url ?? null,
}).where(and(eq(schema.steps.id, step.id), eq(schema.steps.demo_id, id)))
```

- [ ] **Step 6: Run API checks**

Run:

```bash
cd web && npm run lint
```

Expected:

- No TypeScript or ESLint errors in edited API routes.

- [ ] **Step 7: Commit API short-form support**

```bash
git add web/src/app/api/demos/route.ts web/src/app/api/demos/[id]/route.ts web/src/app/api/demos/[id]/start/route.ts web/src/app/api/demos/[id]/steps/route.ts
git commit -m "feat: accept marketing brief inputs"
```

---

### Task 3: Add Website Screenshot Assets and Product Story Scene Generation

**Files:**
- Create: `worker/src/services/parser/assets.ts`
- Create: `worker/src/services/parser/scenes.ts`
- Modify: `worker/src/services/parser/index.ts`
- Modify: `worker/src/workers/parse.worker.ts`
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Create `worker/src/services/parser/assets.ts`**

```ts
import path from 'path'
import fs from 'fs'
import { chromium } from 'playwright'
import { Paths } from '../../utils/paths'

export interface ScreenshotAsset {
  url: string
  role: 'home' | 'features' | 'pricing' | 'customers' | 'about' | 'product'
  localPath: string
  publicUrl: string
}

function pageRole(url: string): ScreenshotAsset['role'] {
  const pathname = new URL(url).pathname.toLowerCase()
  if (pathname.includes('pricing')) return 'pricing'
  if (pathname.includes('customer')) return 'customers'
  if (pathname.includes('about')) return 'about'
  if (pathname.includes('feature')) return 'features'
  if (pathname.includes('product') || pathname.includes('solution')) return 'product'
  return 'home'
}

export async function captureWebsiteScreenshots(demoId: string, urls: string[]): Promise<ScreenshotAsset[]> {
  const outputDir = path.join(Paths.finalDir(demoId), 'assets')
  fs.mkdirSync(outputDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })

  const assets: ScreenshotAsset[] = []
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    for (let i = 0; i < Math.min(urls.length, 5); i++) {
      const url = urls[i]
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
        const role = pageRole(url)
        const localPath = path.join(outputDir, `${String(i + 1).padStart(2, '0')}-${role}.png`)
        await page.screenshot({ path: localPath, fullPage: false })
        assets.push({
          url,
          role,
          localPath,
          publicUrl: `/videos/${demoId}/assets/${path.basename(localPath)}`,
        })
      } catch (err) {
        console.warn(`[parser] screenshot failed ${url}: ${(err as Error).message}`)
      }
    }
  } finally {
    await browser.close()
  }

  return assets
}
```

- [ ] **Step 2: Create `worker/src/services/parser/scenes.ts`**

```ts
import { ScreenshotAsset } from './assets'

export type VisualType = 'screenshot' | 'template' | 'cta'

export interface ProductStoryInput {
  productUrl: string
  description: string | null
  audience?: string | null
  keyPoints?: string | null
  brandTone?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  sourceSummary: string
}

export interface ProductStoryScene {
  position: number
  title: string
  narration: string
  visual_type: VisualType
  visual_asset_url: string | null
}

function productName(productUrl: string, description: string | null): string {
  return description?.split(/[.。!！\n]/)[0]?.trim() || new URL(productUrl).hostname.replace(/^www\./, '')
}

export function fallbackProductStory(input: ProductStoryInput, assets: ScreenshotAsset[]): ProductStoryScene[] {
  const product = productName(input.productUrl, input.description)
  const firstAsset = assets[0]?.publicUrl ?? null
  const secondAsset = assets[1]?.publicUrl ?? firstAsset
  const ctaText = input.ctaText || 'Learn more'

  return [
    {
      position: 1,
      title: `Meet ${product}`,
      narration: `${product} helps teams understand the product value quickly and turn interest into action.`,
      visual_type: firstAsset ? 'screenshot' : 'template',
      visual_asset_url: firstAsset,
    },
    {
      position: 2,
      title: input.audience ? `Built for ${input.audience}` : 'Built for the teams doing the work',
      narration: input.audience
        ? `For ${input.audience}, the story starts with a workflow that needs to become clearer, faster, and easier to act on.`
        : 'The story starts with a workflow that needs to become clearer, faster, and easier to act on.',
      visual_type: secondAsset ? 'screenshot' : 'template',
      visual_asset_url: secondAsset,
    },
    {
      position: 3,
      title: 'Turn product details into outcomes',
      narration: input.keyPoints || 'Show the capabilities that matter, then connect each one to a practical customer outcome.',
      visual_type: assets[2]?.publicUrl ? 'screenshot' : 'template',
      visual_asset_url: assets[2]?.publicUrl ?? null,
    },
    {
      position: 4,
      title: 'Make the next step obvious',
      narration: `The video closes with a clear invitation to ${ctaText.toLowerCase()}, so qualified viewers know exactly what to do next.`,
      visual_type: 'cta',
      visual_asset_url: firstAsset,
    },
  ]
}

export async function generateProductStoryScenes(
  input: ProductStoryInput,
  assets: ScreenshotAsset[],
): Promise<ProductStoryScene[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return fallbackProductStory(input, assets)

  const assetSummary = assets.map((asset, index) => `${index + 1}. ${asset.role}: ${asset.url}`).join('\n')
  const systemPrompt = `You are a senior product marketing video writer.
Return ONLY valid JSON with this shape:
[
  {"position":1,"title":"string","narration":"string","visual_role":"home|features|pricing|customers|about|product|template|cta"}
]
Rules:
- Create 5 to 7 scenes.
- Use Product Story structure: hook, problem, product value, benefit scenes, CTA.
- Keep narration natural for voiceover, 12 to 28 words.
- Avoid invented metrics, fake customer names, and unsupported claims.
- Use the same language as the user's notes when obvious; otherwise use English.`

  const userMessage = [
    `Product URL: ${input.productUrl}`,
    input.description ? `Notes: ${input.description}` : '',
    input.audience ? `Audience: ${input.audience}` : '',
    input.keyPoints ? `Key points: ${input.keyPoints}` : '',
    input.brandTone ? `Brand tone: ${input.brandTone}` : '',
    input.ctaText ? `CTA: ${input.ctaText}` : '',
    input.sourceSummary ? `Website summary:\n${input.sourceSummary}` : '',
    assetSummary ? `Screenshot assets:\n${assetSummary}` : 'No screenshots available.',
  ].filter(Boolean).join('\n\n')

  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 1800,
    }),
  })

  if (!resp.ok) return fallbackProductStory(input, assets)
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return fallbackProductStory(input, assets)

  const parsed = JSON.parse(match[0]) as Array<{ position?: number; title?: string; narration?: string; visual_role?: string }>
  const byRole = new Map(assets.map(asset => [asset.role, asset.publicUrl]))

  return parsed.slice(0, 7).map((scene, index) => {
    const role = scene.visual_role ?? 'template'
    const assetUrl = byRole.get(role as ScreenshotAsset['role']) ?? assets[index % assets.length]?.publicUrl ?? null
    const visualType: VisualType = role === 'cta' ? 'cta' : assetUrl ? 'screenshot' : 'template'
    return {
      position: index + 1,
      title: String(scene.title || `Scene ${index + 1}`).slice(0, 120),
      narration: String(scene.narration || scene.title || '').slice(0, 500),
      visual_type: visualType,
      visual_asset_url: assetUrl,
    }
  })
}
```

- [ ] **Step 3: Refactor `worker/src/services/parser/index.ts`**

Export `analyzePublicWebsite` and include the URL list in the return type:

```ts
export interface WebsiteAnalysis {
  pages: PageData[]
  urls: string[]
  sourceSummary: string
}

export async function analyzePublicWebsite(productUrl: string): Promise<WebsiteAnalysis> {
  const homeHtml = await fetchHtml(productUrl)
  const urls = [productUrl, ...extractLinks(homeHtml, productUrl)]
  const uniqueUrls = Array.from(new Set(urls)).slice(0, MAX_PAGES)
  const pages: PageData[] = []

  for (const url of uniqueUrls) {
    try {
      const html = url === productUrl ? homeHtml : await fetchHtml(url)
      pages.push({
        url,
        title: extractTitle(html),
        description: matchMeta(html, ['description', 'og:description', 'twitter:description']),
        headings: extractHeadings(html),
        text: stripHtml(html).slice(0, MAX_PAGE_TEXT),
      })
    } catch (err) {
      console.warn(`[parser] 跳过页面 ${url}: ${(err as Error).message}`)
    }
  }

  const sourceSummary = pages.map((page, index) => [
    `PAGE ${index + 1}: ${page.url}`,
    page.title ? `Title: ${page.title}` : '',
    page.description ? `Description: ${page.description}` : '',
    page.headings.length ? `Headings: ${page.headings.join(' | ')}` : '',
    `Text: ${page.text}`,
  ].filter(Boolean).join('\n')).join('\n\n')

  return { pages, urls: uniqueUrls, sourceSummary }
}
```

Then change `parseSteps` to accept marketing fields:

```ts
export interface ParseStepsOptions {
  audience?: string | null
  keyPoints?: string | null
  brandTone?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
}
```

and return scenes from `generateProductStoryScenes`.

- [ ] **Step 4: Update `worker/src/workers/parse.worker.ts` job data**

Extend `ParseJobData`:

```ts
export interface ParseJobData {
  demoId: string
  productUrl: string
  description: string | null
  audience?: string | null
  keyPoints?: string | null
  brandTone?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  isReparse?: boolean
}
```

Call:

```ts
const rawSteps = await parseSteps(productUrl, description, {
  audience,
  keyPoints,
  brandTone,
  ctaText,
  ctaUrl,
})
```

Write scene visual fields:

```ts
visual_type: s.visual_type ?? 'template',
visual_asset_url: s.visual_asset_url ?? null,
```

- [ ] **Step 5: Persist source summary and thumbnail**

If `parseSteps` returns `sourceSummary` and first screenshot, update `demos`:

```ts
await db.update(demos).set({
  status: 'review',
  source_summary: parseResult.sourceSummary,
  thumbnail_url: parseResult.thumbnailUrl,
}).where(eq(demos.id, demoId))
```

If keeping `parseSteps` return value simple, create a separate `parseProductStory` function that returns:

```ts
{
  steps: ProductStoryScene[]
  sourceSummary: string
  thumbnailUrl: string | null
}
```

Use that shape consistently in `parse.worker.ts`.

- [ ] **Step 6: Run worker build**

Run:

```bash
cd worker && npm run build
```

Expected:

- TypeScript succeeds.
- No missing imports from `assets.ts` or `scenes.ts`.

- [ ] **Step 7: Commit parser changes**

```bash
git add worker/src/services/parser worker/src/workers/parse.worker.ts worker/src/types.ts
git commit -m "feat: generate product story scenes"
```

---

### Task 4: Upgrade HyperFrames Promotional Renderer

**Files:**
- Modify: `worker/src/services/hyperframes/index.ts`
- Modify: `worker/src/workers/merge.worker.ts`
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Extend promotional scene type**

In `worker/src/services/hyperframes/index.ts`, replace `PromotionalScene` with:

```ts
export interface PromotionalScene {
  title: string
  narration?: string | null
  audioPath?: string
  duration: number
  visualType?: 'screenshot' | 'template' | 'cta'
  visualAssetPath?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  brandTone?: string | null
}
```

- [ ] **Step 2: Resolve visual asset paths**

Add:

```ts
function resolveVisualAsset(value?: string | null): string | null {
  if (!value) return null
  if (value.startsWith('/videos/')) {
    const videoDir = process.env.VIDEO_DIR ?? '/data/videos'
    return path.join(videoDir, value.replace(/^\/videos\//, ''))
  }
  if (fs.existsSync(value)) return value
  return null
}
```

- [ ] **Step 3: Render screenshot stage in `createPromotionalHtml`**

Inside each scene layer, compute:

```ts
const visualPath = resolveVisualAsset(scene.visualAssetPath)
const visualMarkup = visualPath
  ? `<div class="screenshot-stage"><img src="${fileUrl(visualPath)}" /></div>`
  : `<div class="visual"><div class="panel panel-a"></div><div class="panel panel-b"></div><div class="panel panel-c"></div></div>`
```

Use `${visualMarkup}` instead of the current hard-coded `.visual` block.

Add CSS:

```css
.screenshot-stage {
  position: absolute;
  right: 54px;
  bottom: 88px;
  width: 460px;
  height: 330px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.22);
  box-shadow: 0 30px 80px rgba(0,0,0,0.34);
  background: rgba(15,23,42,0.82);
}
.screenshot-stage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 4: Add CTA scene treatment**

In the layer markup, show CTA text when `scene.visualType === 'cta'`:

```ts
${scene.visualType === 'cta' && scene.ctaText ? `<div class="cta-pill">${escapeHtml(scene.ctaText)}</div>` : ''}
```

Add CSS:

```css
.cta-pill {
  position: absolute;
  left: 72px;
  bottom: 80px;
  display: inline-flex;
  align-items: center;
  min-height: 52px;
  padding: 0 24px;
  border-radius: 8px;
  background: #67e8f9;
  color: #083344;
  font-size: 20px;
  font-weight: 800;
}
```

- [ ] **Step 5: Pass scene visuals from `merge.worker.ts`**

In promotional mode mapping:

```ts
const rendered = await renderPromotionalVideo(
  demoSteps.map((step, index) => ({
    title: step.title,
    narration: step.narration,
    audioPath: audioPaths[index],
    duration: Math.max(2, stepTimestamps[index]?.end - stepTimestamps[index]?.start || 4),
    visualType: step.visual_type ?? 'template',
    visualAssetPath: step.visual_asset_url ?? null,
  })),
  Paths.finalDir(demoId),
)
```

Then fetch demo CTA and brand tone before rendering:

```ts
const demoRow = await db
  .select({ cta_text: demos.cta_text, cta_url: demos.cta_url, brand_tone: demos.brand_tone })
  .from(demos)
  .where(eq(demos.id, demoId))
  .then(rows => rows[0] ?? null)
```

Add those values into each promotional scene:

```ts
ctaText: demoRow?.cta_text ?? null,
ctaUrl: demoRow?.cta_url ?? null,
brandTone: demoRow?.brand_tone ?? null,
```

- [ ] **Step 6: Run worker build**

Run:

```bash
cd worker && npm run build
```

Expected:

- TypeScript succeeds.
- `renderPromotionalVideo` receives the extended scene shape.

- [ ] **Step 7: Commit renderer changes**

```bash
git add worker/src/services/hyperframes/index.ts worker/src/workers/merge.worker.ts worker/src/types.ts
git commit -m "feat: render marketing videos with website visuals"
```

---

### Task 5: Update Web UI to Marketing Brief and Scene Review

**Files:**
- Modify: `web/src/components/demo/create-form.tsx`
- Modify: `web/src/app/(dashboard)/demo/[id]/page.tsx`
- Modify: `web/src/locales/en.ts`
- Modify: `web/src/locales/zh.ts`

- [ ] **Step 1: Add short-form state in `CreateForm`**

In `web/src/components/demo/create-form.tsx`, add:

```ts
const [audience, setAudience] = useState('')
const [keyPoints, setKeyPoints] = useState('')
const [brandTone, setBrandTone] = useState('')
const [ctaText, setCtaText] = useState('')
const [ctaUrl, setCtaUrl] = useState('')
```

Update fetch body:

```ts
body: JSON.stringify({
  product_url: url,
  description: desc || null,
  audience: audience || null,
  key_points: keyPoints || null,
  brand_tone: brandTone || null,
  cta_text: ctaText || null,
  cta_url: ctaUrl || null,
}),
```

After success, reset all five fields.

- [ ] **Step 2: Replace optional description accordion with marketing brief fields**

Use this form block under the URL row:

```tsx
<div className="grid gap-3 sm:grid-cols-2">
  <input value={audience} onChange={e => setAudience(e.target.value)} placeholder={cf.audiencePlaceholder} className="rounded-xl px-4 py-3 text-sm outline-none" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F172A' }} />
  <input value={brandTone} onChange={e => setBrandTone(e.target.value)} placeholder={cf.brandTonePlaceholder} className="rounded-xl px-4 py-3 text-sm outline-none" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F172A' }} />
  <input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder={cf.ctaTextPlaceholder} className="rounded-xl px-4 py-3 text-sm outline-none" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F172A' }} />
  <input type="url" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder={cf.ctaUrlPlaceholder} className="rounded-xl px-4 py-3 text-sm outline-none" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F172A' }} />
</div>
<textarea value={keyPoints} onChange={e => setKeyPoints(e.target.value)} rows={3} placeholder={cf.keyPointsPlaceholder} className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F172A' }} />
```

Keep `description` only if product notes are still needed; otherwise map the old `desc` field into `key_points`.

- [ ] **Step 3: Remove paused recovery UI from detail page main path**

In `web/src/app/(dashboard)/demo/[id]/page.tsx`:

- Remove `resolving` state.
- Remove `resolveStep`.
- Remove failed-step retry/skip button block.
- Rename local comments and headers from "步骤" to "场景".
- Change `isRunning` to:

```ts
const isRunning = ['processing', 'parsing'].includes(status)
```

Keep `paused` rendering only as a generic error panel if existing status records are paused.

- [ ] **Step 4: Add visual type badge on scene cards**

Inside each scene card, near the title, add:

```tsx
{step.visual_type && (
  <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}>
    {step.visual_type === 'screenshot' ? dd.visualScreenshot : step.visual_type === 'cta' ? dd.visualCta : dd.visualTemplate}
  </span>
)}
```

- [ ] **Step 5: Update locale keys**

In `web/src/locales/en.ts`, add or update:

```ts
createForm: {
  title: 'Create a marketing video',
  hint: 'Add a product URL and optional brief. Showrunner writes the story and renders the video.',
  audiencePlaceholder: 'Audience, e.g. sales teams',
  keyPointsPlaceholder: 'Key points or benefits to emphasize',
  brandTonePlaceholder: 'Tone, e.g. confident, warm, technical',
  ctaTextPlaceholder: 'CTA text, e.g. Book a demo',
  ctaUrlPlaceholder: 'CTA URL',
}
```

In `web/src/locales/zh.ts`, add matching Chinese strings:

```ts
createForm: {
  title: '创建营销视频',
  hint: '填写产品 URL 和可选 brief，Showrunner 自动生成脚本并渲染视频。',
  audiencePlaceholder: '目标受众，例如销售团队',
  keyPointsPlaceholder: '希望强调的卖点或收益',
  brandTonePlaceholder: '品牌语气，例如自信、温暖、技术感',
  ctaTextPlaceholder: 'CTA 文案，例如预约演示',
  ctaUrlPlaceholder: 'CTA 链接',
}
```

Preserve existing locale keys still used by components.

- [ ] **Step 6: Run web lint**

Run:

```bash
cd web && npm run lint
```

Expected:

- No React or TypeScript lint errors.

- [ ] **Step 7: Commit UI changes**

```bash
git add web/src/components/demo/create-form.tsx web/src/app/(dashboard)/demo/[id]/page.tsx web/src/locales/en.ts web/src/locales/zh.ts
git commit -m "feat: add marketing brief UI"
```

---

### Task 6: Update Share Page and Product Copy

**Files:**
- Modify: `web/src/app/share/[token]/page.tsx`
- Modify: `web/src/app/api/share/[token]/route.ts`
- Modify: `web/src/locales/en.ts`
- Modify: `web/src/locales/zh.ts`

- [ ] **Step 1: Confirm share API returns CTA and scene timestamps**

In `web/src/app/api/share/[token]/route.ts`, ensure the selected demo fields include:

```ts
title: schema.demos.title,
video_url: schema.demos.video_url,
duration: schema.demos.duration,
cta_url: schema.demos.cta_url,
cta_text: schema.demos.cta_text,
```

Ensure steps select:

```ts
position: schema.steps.position,
title: schema.steps.title,
timestamp_start: schema.steps.timestamp_start,
timestamp_end: schema.steps.timestamp_end,
```

- [ ] **Step 2: Rename fallback title in share page**

In `web/src/app/share/[token]/page.tsx`, replace hard-coded fallback strings:

```ts
data.title ?? 'Product Promo Video'
```

with:

```ts
data.title ?? sp.defaultTitle
```

Ensure `sp.defaultTitle` is "Product Story Video" in English and "产品营销视频" in Chinese.

- [ ] **Step 3: Update share labels**

In locale files, use marketing language:

```ts
sharePage: {
  defaultTitle: 'Product Story Video',
  chapters: 'Scenes',
  shareLabel: 'Share this marketing video',
  downloadVideo: 'Download video',
  ctaDefault: 'Learn more',
}
```

Chinese:

```ts
sharePage: {
  defaultTitle: '产品营销视频',
  chapters: '场景',
  shareLabel: '分享这个营销视频',
  downloadVideo: '下载视频',
  ctaDefault: '了解更多',
}
```

- [ ] **Step 4: Run web lint**

Run:

```bash
cd web && npm run lint
```

Expected:

- Share API and page compile without missing locale keys.

- [ ] **Step 5: Commit share copy changes**

```bash
git add web/src/app/share/[token]/page.tsx web/src/app/api/share/[token]/route.ts web/src/locales/en.ts web/src/locales/zh.ts
git commit -m "feat: update marketing video share page"
```

---

### Task 7: Update Documentation and Remove Main-Path Recording References

**Files:**
- Modify: `docs/product-decisions.md`
- Modify: `docs/system-architecture.md`
- Modify: `docs/api-design.md`
- Modify: `docs/hyperframes-refactor.md`
- Modify: `docs/database-schema.md`

- [ ] **Step 1: Update product positioning**

In `docs/product-decisions.md`, replace the one-line description with:

```md
B2B SaaS 产品的自动营销视频生成工具，用户粘贴产品 URL 并补充一个短 brief，系统自动生成带旁白、官网视觉素材、CTA 和分享页的 Product Story 视频。
```

Replace "浏览器自动录制" MVP item with:

```md
| 官网分析与截图 | 抓取公开页面内容，捕获首页/功能/价格等视觉素材 |
```

Replace "录制失败用户介入" with:

```md
| 素材兜底 | 官网抓取或截图失败时使用模板动态图形 |
```

- [ ] **Step 2: Update architecture docs**

In `docs/system-architecture.md`, make the worker queue list:

```text
Queue: parse-queue
  1. 抓取官网公开内容
  2. 捕获可用官网截图
  3. 调用 AI 生成 Product Story 场景
  4. 写入 steps，更新 demo.status = review

Queue: tts-queue
  5. 为每个场景生成旁白音频

Queue: merge-queue
  6. HyperFrames 合成官网截图 + 动态包装 + 旁白
  7. 上传 R2 或本地视频目录
  8. 更新 demo.status = completed
```

Remove claims that primary generation uses Playwright to click through the target product.

- [ ] **Step 3: Update API docs**

In `docs/api-design.md`, update `POST /api/demos` request example:

```json
{
  "product_url": "https://example.com",
  "audience": "Sales teams",
  "key_points": "Automates follow-up and improves conversion",
  "brand_tone": "confident",
  "cta_text": "Book a demo",
  "cta_url": "https://example.com/demo"
}
```

Update `/start` docs to say it triggers `tts-queue`, not `record-queue`.

- [ ] **Step 4: Update database docs**

In `docs/database-schema.md`, add the marketing fields to `demos` and `steps` exactly as in Task 1. Note that `steps` now stores video scenes for the primary MVP.

- [ ] **Step 5: Run reference scan**

Run:

```bash
rg -n "Clerk|Supabase|OpenRouter|Playwright 录制|record-queue|录制失败|浏览器自动录制" docs
```

Expected:

- Any remaining references are explicitly marked deprecated, historical, or out of scope.

- [ ] **Step 6: Commit docs**

```bash
git add docs/product-decisions.md docs/system-architecture.md docs/api-design.md docs/hyperframes-refactor.md docs/database-schema.md
git commit -m "docs: update architecture for marketing videos"
```

---

### Task 8: End-to-End Verification

**Files:**
- No planned source edits unless verification reveals bugs.

- [ ] **Step 1: Run web lint**

Run:

```bash
cd web && npm run lint
```

Expected:

- PASS.

- [ ] **Step 2: Run worker build**

Run:

```bash
cd worker && npm run build
```

Expected:

- PASS.

- [ ] **Step 3: Start local stack if dependencies are available**

Run:

```bash
docker compose up -d mysql redis
```

Expected:

- MySQL and Redis containers become healthy.

- [ ] **Step 4: Run web and worker in separate terminals**

Terminal 1:

```bash
cd web && npm run dev
```

Terminal 2:

```bash
cd worker && npm run dev
```

Expected:

- Web listens on `http://localhost:3000`.
- Worker starts parse, tts, and merge workers.

- [ ] **Step 5: Manual smoke test**

In the app:

1. Create a video with `https://linear.app`, audience `product teams`, CTA `Book a demo`.
2. Wait for `review`.
3. Confirm scenes show Product Story titles and visual badges.
4. Click generate.
5. Wait for `completed`.
6. Open the share page.
7. Confirm the video plays and the CTA button appears.

- [ ] **Step 6: Record verification notes**

Create a short note in the final implementation response with:

```text
Verification:
- web lint: pass/fail
- worker build: pass/fail
- local smoke: pass/fail or not run with reason
```

- [ ] **Step 7: Final commit if verification fixes were needed**

If any bugs were fixed during verification:

```bash
git add <fixed-files>
git commit -m "fix: complete marketing video smoke path"
```

If no changes were needed after Task 7, do not create an empty commit.

---

## Self-Review

- Spec coverage: This plan covers short-form input, Product Story scenes, hybrid screenshot/template visuals, promotional-only render, UI copy, docs, and verification.
- Scope boundary: This plan intentionally keeps recorder code and `record-queue` definitions temporarily unused instead of deleting them.
- Type consistency: Scene visual fields use `visual_type` and `visual_asset_url` in DB/API payloads, and `visualType`/`visualAssetPath` only inside HyperFrames renderer inputs.
- Placeholder scan: No task contains unresolved placeholder markers. Any fallback behavior is specified with concrete code or explicit expected behavior.
