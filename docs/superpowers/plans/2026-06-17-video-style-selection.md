# Video Style Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add default automatic video style matching and paid manual style selection with Starter and Pro tier restrictions.

**Architecture:** Add enum-backed video style catalogs in web and worker code, persist `demos.video_style`, validate style access in the create API, pass the selected style through parse and merge jobs, and make HyperFrames emit style-specific classes/tokens. Keep style selection video-level only; per-scene and free-form custom styles stay out of scope.

**Tech Stack:** Next.js App Router, Drizzle MySQL schema, BullMQ workers, TypeScript script tests, HyperFrames HTML/CSS renderer.

---

## File Structure

- Create `web/src/lib/video-styles.ts`: web-facing video style catalog, type guards, and plan access helpers.
- Create `worker/src/services/video-styles.ts`: worker-facing style catalog and prompt/render descriptors.
- Modify `web/src/lib/plans.ts`: add `manualVideoStyles` capability flag and re-export/use video style helpers where needed.
- Modify `web/src/components/demo/create-form.tsx`: add the video style control and submit `video_style`.
- Modify `web/src/locales/zh.ts` and `web/src/locales/en.ts`: add create-form copy for video styles.
- Modify `web/src/app/api/demos/route.ts`: validate, persist, and enqueue `video_style`.
- Modify `web/src/lib/db/schema.ts`, `worker/src/utils/db.ts`, `database/schema.sql`: expose `demos.video_style`.
- Create `database/migrations/20260617_video_style_selection.sql`: idempotent MySQL migration.
- Modify `worker/src/workers/parse.worker.ts`: accept `videoStyle` and pass it to parser options.
- Modify `worker/src/services/parser/index.ts`: extend `ParseStepsOptions`, `ProductStoryInput`, and `productStorySceneMetadata` propagation.
- Modify `worker/src/services/parser/scenes.ts`: apply style descriptors in AI prompt, user message, normalization, and fallback scenes.
- Modify `worker/src/workers/merge.worker.ts`: read demo-level `video_style`, parse step metadata style ID, and pass style to promotional scenes.
- Modify `worker/src/services/hyperframes/index.ts`: add `styleId` to scenes and generate style classes/CSS tokens.
- Modify `web/scripts/test-plan-capabilities.ts`: cover style catalog and UI/API source checks.
- Modify `web/scripts/test-tts-schema.ts`: include `video_style` schema and migration checks.
- Modify `worker/scripts/test-openai-compatible-scenes.ts`: verify manual style reaches AI prompt/body and scenes.
- Modify `worker/scripts/test-promotional-scenes.ts`: verify style metadata maps into promotional scenes.
- Modify `worker/scripts/test-hyperframes-composition.ts`: verify style classes/tokens are emitted.

---

### Task 1: Web Style Catalog And Plan Tests

**Files:**
- Create: `web/src/lib/video-styles.ts`
- Modify: `web/src/lib/plans.ts`
- Modify: `web/scripts/test-plan-capabilities.ts`

- [ ] **Step 1: Write failing plan capability tests**

Add these imports in `web/scripts/test-plan-capabilities.ts`:

```ts
import {
  canUseVideoStyle,
  getAllowedVideoStyles,
  isVideoStyleId,
  VIDEO_STYLES,
} from '../src/lib/video-styles'
```

Add these assertions after the TTS speed assertions:

```ts
assert.equal(getPlanCapabilities('free').manualVideoStyles, false)
assert.equal(getPlanCapabilities('starter').manualVideoStyles, true)
assert.equal(getPlanCapabilities('pro').manualVideoStyles, true)

assert.deepEqual(getAllowedVideoStyles('free').map(style => style.id), ['auto'])
assert.deepEqual(
  getAllowedVideoStyles('starter').map(style => style.id),
  ['auto', 'clean_saas', 'bold_launch', 'warm_editorial'],
)
assert.deepEqual(
  getAllowedVideoStyles('pro').map(style => style.id),
  VIDEO_STYLES.map(style => style.id),
)

assert.equal(isVideoStyleId('auto'), true)
assert.equal(isVideoStyleId('creator_social'), true)
assert.equal(isVideoStyleId('unknown_style'), false)

assert.equal(canUseVideoStyle('free', 'auto'), true)
assert.equal(canUseVideoStyle('free', 'clean_saas'), false)
assert.equal(canUseVideoStyle('starter', 'clean_saas'), true)
assert.equal(canUseVideoStyle('starter', 'technical_dark'), false)
assert.equal(canUseVideoStyle('pro', 'technical_dark'), true)
assert.equal(canUseVideoStyle('pro', 'unknown_style'), false)
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd web && npx tsx scripts/test-plan-capabilities.ts
```

Expected: FAIL because `../src/lib/video-styles` does not exist or `manualVideoStyles` is missing.

- [ ] **Step 3: Create the web video style catalog**

Create `web/src/lib/video-styles.ts`:

```ts
import type { PlanType } from '@/types'

export type VideoStyleId =
  | 'auto'
  | 'clean_saas'
  | 'bold_launch'
  | 'warm_editorial'
  | 'technical_dark'
  | 'premium_minimal'
  | 'creator_social'

export interface VideoStyleOption {
  id: VideoStyleId
  label: string
  description: string
  starter: boolean
}

export const VIDEO_STYLE_DEFAULT: VideoStyleId = 'auto'

export const VIDEO_STYLES: VideoStyleOption[] = [
  {
    id: 'auto',
    label: 'Smart match',
    description: 'Automatically matches style to the product, brand, and category.',
    starter: true,
  },
  {
    id: 'clean_saas',
    label: 'Clean SaaS',
    description: 'Quiet, product-forward SaaS style for B2B and tools.',
    starter: true,
  },
  {
    id: 'bold_launch',
    label: 'Bold Launch',
    description: 'High-contrast, energetic launch style for promotions.',
    starter: true,
  },
  {
    id: 'warm_editorial',
    label: 'Warm Editorial',
    description: 'Story-led editorial style for commerce, services, and content.',
    starter: true,
  },
  {
    id: 'technical_dark',
    label: 'Technical Dark',
    description: 'Dark, code-forward style for developer and technical products.',
    starter: false,
  },
  {
    id: 'premium_minimal',
    label: 'Premium Minimal',
    description: 'Sparse, premium, restrained style for polished brand stories.',
    starter: false,
  },
  {
    id: 'creator_social',
    label: 'Creator Social',
    description: 'Punchier social promo treatment for creator-led products.',
    starter: false,
  },
]

export function isVideoStyleId(value: unknown): value is VideoStyleId {
  return typeof value === 'string' && VIDEO_STYLES.some(style => style.id === value)
}

export function normalizeVideoStyleId(value: unknown): VideoStyleId | null {
  if (value == null || value === '') return VIDEO_STYLE_DEFAULT
  return isVideoStyleId(value) ? value : null
}

export function getAllowedVideoStyles(plan: PlanType): VideoStyleOption[] {
  if (plan === 'free') {
    return VIDEO_STYLES.filter(style => style.id === VIDEO_STYLE_DEFAULT)
  }

  if (plan === 'starter') {
    return VIDEO_STYLES.filter(style => style.starter)
  }

  return VIDEO_STYLES
}

export function canUseVideoStyle(plan: PlanType, styleId: string | null | undefined): boolean {
  const normalizedStyleId = normalizeVideoStyleId(styleId)
  if (!normalizedStyleId) return false
  return getAllowedVideoStyles(plan).some(style => style.id === normalizedStyleId)
}
```

- [ ] **Step 4: Add plan capability flag**

In `web/src/lib/plans.ts`, add `manualVideoStyles: boolean` to `PlanCapabilities`, then set:

```ts
free: {
  videosPerMonth: 1,
  voiceSelection: false,
  perSceneVoice: false,
  ttsSpeedControl: false,
  customAudio: false,
  priorityQueue: false,
  manualVideoStyles: false,
},
starter: {
  videosPerMonth: 10,
  voiceSelection: true,
  perSceneVoice: false,
  ttsSpeedControl: true,
  customAudio: false,
  priorityQueue: false,
  manualVideoStyles: true,
},
pro: {
  videosPerMonth: -1,
  voiceSelection: true,
  perSceneVoice: true,
  ttsSpeedControl: true,
  customAudio: true,
  priorityQueue: true,
  manualVideoStyles: true,
},
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
cd web && npx tsx scripts/test-plan-capabilities.ts
```

Expected: PASS with `plan capability tests passed`.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/video-styles.ts web/src/lib/plans.ts web/scripts/test-plan-capabilities.ts
git commit -m "feat: add video style plan capabilities"
```

---

### Task 2: Database Schema And Migration

**Files:**
- Create: `database/migrations/20260617_video_style_selection.sql`
- Modify: `database/schema.sql`
- Modify: `web/src/lib/db/schema.ts`
- Modify: `worker/src/utils/db.ts`
- Modify: `web/scripts/test-tts-schema.ts`

- [ ] **Step 1: Write failing schema tests**

In `web/scripts/test-tts-schema.ts`, add:

```ts
const videoStyleMigration = read('database/migrations/20260617_video_style_selection.sql')
```

After the existing `for (const source of [schemaSql, migration])` block, add:

```ts
for (const source of [schemaSql, videoStyleMigration]) {
  assert.match(source, /video_style\s+VARCHAR\(40\)/i, 'demos should include video_style')
  assert.match(source, /video_style\s+VARCHAR\(40\)\s+NOT NULL\s+DEFAULT\s+'auto'/i, 'video_style should default to auto')
}
```

After web schema assertions, add:

```ts
assert.match(webSchema, /video_style:\s+varchar\('video_style'/, 'web demo schema should expose video_style')
assert.match(workerSchema, /video_style:\s+varchar\('video_style'/, 'worker schema should expose video_style')
```

- [ ] **Step 2: Run the failing schema test**

Run:

```bash
cd web && npx tsx scripts/test-tts-schema.ts
```

Expected: FAIL because `database/migrations/20260617_video_style_selection.sql` does not exist or schemas do not expose `video_style`.

- [ ] **Step 3: Add migration**

Create `database/migrations/20260617_video_style_selection.sql`:

```sql
-- Add video style selection to demos.
-- Safe to run repeatedly on MySQL 8.0.

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;

DELIMITER //

CREATE PROCEDURE showrunner_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @add_column_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
    PREPARE add_column_stmt FROM @add_column_sql;
    EXECUTE add_column_stmt;
    DEALLOCATE PREPARE add_column_stmt;
  END IF;
END//

DELIMITER ;

CALL showrunner_add_column_if_missing('demos', 'video_style', 'video_style VARCHAR(40) NOT NULL DEFAULT ''auto'' AFTER brand_tone');

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;
```

- [ ] **Step 4: Update SQL schema**

In `database/schema.sql`, add this line after `brand_tone` in the `demos` table:

```sql
  video_style   VARCHAR(40)                                                                             NOT NULL DEFAULT 'auto',
```

- [ ] **Step 5: Update Drizzle schemas**

In `web/src/lib/db/schema.ts`, add this property after `brand_tone`:

```ts
  video_style:    varchar('video_style', { length: 40 }).default('auto').notNull(),
```

In `worker/src/utils/db.ts`, add this property after `brand_tone`:

```ts
  video_style:    varchar('video_style', { length: 40 }).default('auto').notNull(),
```

- [ ] **Step 6: Run schema test**

Run:

```bash
cd web && npx tsx scripts/test-tts-schema.ts
```

Expected: PASS with `tts schema tests passed`.

- [ ] **Step 7: Commit**

```bash
git add database/schema.sql database/migrations/20260617_video_style_selection.sql web/src/lib/db/schema.ts worker/src/utils/db.ts web/scripts/test-tts-schema.ts
git commit -m "feat: persist video style on demos"
```

---

### Task 3: Create API Validation And Queue Propagation

**Files:**
- Modify: `web/src/app/api/demos/route.ts`
- Modify: `web/scripts/test-plan-capabilities.ts`

- [ ] **Step 1: Write failing route source tests**

In `web/scripts/test-plan-capabilities.ts`, add these assertions near the existing `demosRoute` assertions:

```ts
assert.match(demosRoute, /normalizeVideoStyleId/, 'create demo API should normalize video_style')
assert.match(demosRoute, /canUseVideoStyle\(subscription\.plan,\s*video_style\)/, 'create demo API should validate video style by plan')
assert.match(demosRoute, /video_style:\s*video_style/, 'create demo API should persist the selected video style')
assert.match(demosRoute, /videoStyle:\s*video_style/, 'create demo API should enqueue the selected video style')
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd web && npx tsx scripts/test-plan-capabilities.ts
```

Expected: FAIL because `route.ts` does not normalize, validate, persist, or enqueue `video_style`.

- [ ] **Step 3: Update create route imports and schema**

In `web/src/app/api/demos/route.ts`, add:

```ts
import { canUseVideoStyle, normalizeVideoStyleId } from '@/lib/video-styles'
```

Add `video_style` to `CreateDemoSchema`:

```ts
  video_style: z.string().max(40).nullable().optional(),
```

- [ ] **Step 4: Normalize and validate `video_style`**

Replace the destructuring line:

```ts
  const { product_url, description, audience, key_points, brand_tone, cta_text, cta_url } = parsed.data
```

with:

```ts
  const { product_url, description, audience, key_points, brand_tone, cta_text, cta_url } = parsed.data
  const video_style = normalizeVideoStyleId(parsed.data.video_style)
  if (video_style === null) {
    return err('VALIDATION_ERROR', '请选择有效的视频风格')
  }
```

After the TTS speed access check, add:

```ts
  if (!canUseVideoStyle(subscription.plan, video_style)) {
    return err('PLAN_RESTRICTED', '当前套餐不支持选择该视频风格')
  }
```

- [ ] **Step 5: Persist and enqueue style**

In the demo insert values, add:

```ts
      video_style,
```

In the parse queue payload, add:

```ts
      videoStyle: video_style,
```

- [ ] **Step 6: Run route source test**

Run:

```bash
cd web && npx tsx scripts/test-plan-capabilities.ts
```

Expected: PASS with `plan capability tests passed`.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/api/demos/route.ts web/scripts/test-plan-capabilities.ts
git commit -m "feat: validate selected video style"
```

---

### Task 4: Create Form UI And Localization

**Files:**
- Modify: `web/src/components/demo/create-form.tsx`
- Modify: `web/src/locales/zh.ts`
- Modify: `web/src/locales/en.ts`
- Modify: `web/scripts/test-plan-capabilities.ts`

- [ ] **Step 1: Write failing form source tests**

In `web/scripts/test-plan-capabilities.ts`, add these assertions near the existing `createFormSource` assertions:

```ts
assert.match(createFormSource, /getAllowedVideoStyles\(plan\)/, 'CreateForm should show video styles allowed by the current plan')
assert.match(createFormSource, /VIDEO_STYLES\.map/, 'CreateForm should render the full style catalog with locked options')
assert.match(createFormSource, /video_style:\s*videoStyleId/, 'CreateForm should send selected video_style')
assert.match(createFormSource, /setVideoStyleId\(VIDEO_STYLE_DEFAULT\)/, 'CreateForm should reset video style to auto after create')
assert.match(createFormSource, /cf\.videoStyleLabel/, 'CreateForm should use localized video style labels')
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd web && npx tsx scripts/test-plan-capabilities.ts
```

Expected: FAIL because `CreateForm` does not render or submit video styles.

- [ ] **Step 3: Update form imports and state**

In `web/src/components/demo/create-form.tsx`, add:

```ts
import {
  getAllowedVideoStyles,
  VIDEO_STYLE_DEFAULT,
  VIDEO_STYLES,
  type VideoStyleId,
} from '@/lib/video-styles'
```

After `const allowedVoices = getAllowedTtsVoices(plan)`, add:

```ts
  const allowedStyles = getAllowedVideoStyles(plan)
  const allowedStyleIds = new Set(allowedStyles.map(style => style.id))
```

Add state after `ttsSpeed`:

```ts
  const [videoStyleId, setVideoStyleId] = useState<VideoStyleId>(VIDEO_STYLE_DEFAULT)
```

- [ ] **Step 4: Submit and reset `video_style`**

In the JSON request body, add:

```ts
          video_style: videoStyleId,
```

After `setTtsSpeed(TTS_SPEED_DEFAULT)`, add:

```ts
      setVideoStyleId(VIDEO_STYLE_DEFAULT)
```

- [ ] **Step 5: Render compact style selector**

Add this label after the TTS speed selector and before `audience`:

```tsx
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{cf.videoStyleLabel}</span>
              <select
                value={videoStyleId}
                onChange={e => setVideoStyleId(e.target.value as VideoStyleId)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  color: '#0F172A',
                }}
              >
                {VIDEO_STYLES.map(style => {
                  const locked = !allowedStyleIds.has(style.id)
                  const copy = cf.videoStyles[style.id]
                  return (
                    <option key={style.id} value={style.id} disabled={locked}>
                      {copy.label}{locked ? ` · ${style.starter ? cf.videoStyleStarterLocked : cf.videoStyleProLocked}` : ''}
                    </option>
                  )
                })}
              </select>
              <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                {plan === 'free' ? cf.videoStyleFreeHint : plan === 'starter' ? cf.videoStyleStarterHint : cf.videoStyleProHint}
              </p>
            </label>
```

- [ ] **Step 6: Add Chinese locale copy**

In `web/src/locales/zh.ts` under `createForm`, add:

```ts
    videoStyleLabel: '视频风格',
    videoStyleStarterLocked: 'Starter 解锁',
    videoStyleProLocked: 'Pro 解锁',
    videoStyleFreeHint: 'Free 自动匹配视频风格。升级 Starter 可手动选择部分风格。',
    videoStyleStarterHint: 'Starter 可选择常用视频风格。Pro 解锁全部风格。',
    videoStyleProHint: 'Pro 可选择全部视频风格。',
    videoStyles: {
      auto: {
        label: '智能匹配',
        description: '根据产品类别、品牌色和内容自动匹配风格。',
      },
      clean_saas: {
        label: 'Clean SaaS',
        description: '清晰克制，适合 SaaS、B2B 和工具产品。',
      },
      bold_launch: {
        label: 'Bold Launch',
        description: '高对比、强发布感，适合新品和推广活动。',
      },
      warm_editorial: {
        label: 'Warm Editorial',
        description: '更有叙事感，适合电商、服务和内容产品。',
      },
      technical_dark: {
        label: 'Technical Dark',
        description: '深色技术感，适合开发者和技术产品。',
      },
      premium_minimal: {
        label: 'Premium Minimal',
        description: '高级、留白、克制的品牌表达。',
      },
      creator_social: {
        label: 'Creator Social',
        description: '节奏更快，适合社媒传播和创作者产品。',
      },
    } as Record<string, { label: string; description: string }>,
```

- [ ] **Step 7: Add English locale copy**

In `web/src/locales/en.ts` under `createForm`, add:

```ts
    videoStyleLabel: 'Video style',
    videoStyleStarterLocked: 'Starter unlock',
    videoStyleProLocked: 'Pro unlock',
    videoStyleFreeHint: 'Free automatically matches the video style. Upgrade to Starter to choose selected styles.',
    videoStyleStarterHint: 'Starter can choose common video styles. Pro unlocks the full catalog.',
    videoStyleProHint: 'Pro can choose the full video style catalog.',
    videoStyles: {
      auto: {
        label: 'Smart match',
        description: 'Automatically matches style to product category, brand colors, and content.',
      },
      clean_saas: {
        label: 'Clean SaaS',
        description: 'Clear and restrained for SaaS, B2B, and tool products.',
      },
      bold_launch: {
        label: 'Bold Launch',
        description: 'High-contrast launch energy for new products and promos.',
      },
      warm_editorial: {
        label: 'Warm Editorial',
        description: 'Story-led warmth for commerce, services, and content products.',
      },
      technical_dark: {
        label: 'Technical Dark',
        description: 'Dark technical treatment for developer and technical products.',
      },
      premium_minimal: {
        label: 'Premium Minimal',
        description: 'Premium, sparse, restrained brand expression.',
      },
      creator_social: {
        label: 'Creator Social',
        description: 'Faster social pacing for creator-led products.',
      },
    },
```

- [ ] **Step 8: Run form source test**

Run:

```bash
cd web && npx tsx scripts/test-plan-capabilities.ts
```

Expected: PASS with `plan capability tests passed`.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/demo/create-form.tsx web/src/locales/zh.ts web/src/locales/en.ts web/scripts/test-plan-capabilities.ts
git commit -m "feat: add video style selector"
```

---

### Task 5: Worker Style Catalog And Parser Propagation

**Files:**
- Create: `worker/src/services/video-styles.ts`
- Modify: `worker/src/services/parser/scenes.ts`
- Modify: `worker/src/services/parser/index.ts`
- Modify: `worker/src/workers/parse.worker.ts`
- Modify: `worker/scripts/test-openai-compatible-scenes.ts`

- [ ] **Step 1: Write failing worker parser tests**

In `worker/scripts/test-openai-compatible-scenes.ts`, update the `generateProductStoryScenes` input with:

```ts
    videoStyle: 'technical_dark',
```

Add these assertions after existing request-body assertions:

```ts
  assert.match(JSON.stringify(requestedBody), /technical_dark/)
  assert.match(JSON.stringify(requestedBody), /Dark, code-forward technical style/)
  assert.equal(scenes[0]?.style_id, 'technical_dark')
  assert.equal(scenes[1]?.style_id, 'technical_dark')
```

- [ ] **Step 2: Run the failing parser test**

Run:

```bash
cd worker && npx tsx scripts/test-openai-compatible-scenes.ts
```

Expected: FAIL because `videoStyle` and `style_id` are not defined.

- [ ] **Step 3: Create worker style descriptors**

Create `worker/src/services/video-styles.ts`:

```ts
export type VideoStyleId =
  | 'auto'
  | 'clean_saas'
  | 'bold_launch'
  | 'warm_editorial'
  | 'technical_dark'
  | 'premium_minimal'
  | 'creator_social'

export interface VideoStyleDescriptor {
  id: VideoStyleId
  label: string
  prompt: string
  fallbackVisualStyle: string
  className: string
}

export const VIDEO_STYLE_DEFAULT: VideoStyleId = 'auto'

export const VIDEO_STYLE_DESCRIPTORS: Record<VideoStyleId, VideoStyleDescriptor> = {
  auto: {
    id: 'auto',
    label: 'Smart match',
    prompt: 'Infer the best visual style from product category, brand colors, source material, and brand tone.',
    fallbackVisualStyle: 'product-matched',
    className: 'style-auto',
  },
  clean_saas: {
    id: 'clean_saas',
    label: 'Clean SaaS',
    prompt: 'Quiet, product-forward SaaS style with clear surfaces, restrained accents, and dashboard/product proof emphasis.',
    fallbackVisualStyle: 'clean SaaS product story',
    className: 'style-clean-saas',
  },
  bold_launch: {
    id: 'bold_launch',
    label: 'Bold Launch',
    prompt: 'High-contrast launch and promo style with confident headlines, energetic accents, and stronger call-to-action rhythm.',
    fallbackVisualStyle: 'bold launch promo',
    className: 'style-bold-launch',
  },
  warm_editorial: {
    id: 'warm_editorial',
    label: 'Warm Editorial',
    prompt: 'Story-led editorial style with warmer surfaces, human benefit framing, and calm product proof.',
    fallbackVisualStyle: 'warm editorial product story',
    className: 'style-warm-editorial',
  },
  technical_dark: {
    id: 'technical_dark',
    label: 'Technical Dark',
    prompt: 'Dark, code-forward technical style for developer and technical products, with proof, code, APIs, or workflow details emphasized.',
    fallbackVisualStyle: 'dark technical product story',
    className: 'style-technical-dark',
  },
  premium_minimal: {
    id: 'premium_minimal',
    label: 'Premium Minimal',
    prompt: 'Sparse, premium, restrained brand style with high whitespace, fewer chips, neutral surfaces, and precise copy.',
    fallbackVisualStyle: 'premium minimal brand story',
    className: 'style-premium-minimal',
  },
  creator_social: {
    id: 'creator_social',
    label: 'Creator Social',
    prompt: 'Punchier social promo style with sharper pacing, shorter captions, and creator-friendly benefit framing.',
    fallbackVisualStyle: 'creator social promo',
    className: 'style-creator-social',
  },
}

export function isVideoStyleId(value: unknown): value is VideoStyleId {
  return typeof value === 'string' && value in VIDEO_STYLE_DESCRIPTORS
}

export function normalizeVideoStyleId(value: unknown): VideoStyleId {
  return isVideoStyleId(value) ? value : VIDEO_STYLE_DEFAULT
}

export function getVideoStyleDescriptor(value: unknown): VideoStyleDescriptor {
  return VIDEO_STYLE_DESCRIPTORS[normalizeVideoStyleId(value)]
}
```

- [ ] **Step 4: Extend parser scene types**

In `worker/src/services/parser/scenes.ts`, import:

```ts
import {
  getVideoStyleDescriptor,
  normalizeVideoStyleId,
  type VideoStyleId,
} from '../video-styles'
```

Add `videoStyle?: VideoStyleId` to `ProductStoryInput`.

Add `style_id: VideoStyleId` to `ProductStoryScene`.

Add these optional raw fields to `RawScene`:

```ts
  style_id?: string
  styleId?: string
```

- [ ] **Step 5: Normalize style in scenes**

Change `normalizeScenes` signature to:

```ts
function normalizeScenes(
  rawScenes: RawScene[],
  assets: ScreenshotAsset[],
  productCategory: ProductCategory = DEFAULT_PRODUCT_CATEGORY,
  videoStyle: VideoStyleId = 'auto',
): ProductStoryScene[] {
```

Inside the mapped return object, add:

```ts
      style_id: normalizeVideoStyleId(scene.style_id ?? scene.styleId ?? videoStyle),
```

Update both calls to `normalizeScenes`:

```ts
  return normalizeScenes(rawScenes, assets, productCategory, normalizeVideoStyleId(input.videoStyle))
```

and:

```ts
    const scenes = normalizeScenes(rawScenes, assets, normalizeProductCategory(input.productCategory), normalizeVideoStyleId(input.videoStyle))
```

- [ ] **Step 6: Apply style to fallback scenes**

In `fallbackProductStory`, add:

```ts
  const style = getVideoStyleDescriptor(input.videoStyle)
```

Replace the first four fallback scene `visual_style` values with:

```ts
      visual_style: tone || style.fallbackVisualStyle,
```

Replace the CTA fallback scene `visual_style` value with:

```ts
      visual_style: tone || `${style.fallbackVisualStyle} CTA`,
```

Call `normalizeScenes(rawScenes, assets, productCategory, style.id)`.

- [ ] **Step 7: Add style to AI prompt and user message**

In `generateProductStoryScenes`, add:

```ts
  const style = getVideoStyleDescriptor(input.videoStyle)
```

Add this rule to the system prompt:

```ts
- Include "style_id" on every scene. Use the requested style id exactly unless it is "auto"; when "auto", infer the best style and still return "auto" as style_id.
```

Add this line to `userMessage` before source summary:

```ts
    `Requested video style: ${style.id} - ${style.prompt}`,
```

- [ ] **Step 8: Extend parser index metadata**

In `worker/src/services/parser/index.ts`, import:

```ts
import { normalizeVideoStyleId, type VideoStyleId } from '../video-styles'
```

Add `videoStyle?: VideoStyleId` to `ParseStepsOptions`.

In `buildInput`, add:

```ts
    videoStyle: normalizeVideoStyleId(options.videoStyle),
```

In `productStorySceneMetadata`, add:

```ts
    styleId: scene.style_id ?? 'auto',
```

- [ ] **Step 9: Extend parse worker data**

In `worker/src/workers/parse.worker.ts`, import:

```ts
import { normalizeVideoStyleId, type VideoStyleId } from '../services/video-styles'
```

Add this field to `ParseJobData`:

```ts
  videoStyle?: VideoStyleId
```

Add this option in `processJob`:

```ts
    videoStyle: normalizeVideoStyleId(job.data.videoStyle),
```

- [ ] **Step 10: Run parser test**

Run:

```bash
cd worker && npx tsx scripts/test-openai-compatible-scenes.ts
```

Expected: PASS with `openai-compatible scene tests passed`.

- [ ] **Step 11: Commit**

```bash
git add worker/src/services/video-styles.ts worker/src/services/parser/scenes.ts worker/src/services/parser/index.ts worker/src/workers/parse.worker.ts worker/scripts/test-openai-compatible-scenes.ts
git commit -m "feat: propagate video style through parser"
```

---

### Task 6: Merge Mapping And HyperFrames Style Tokens

**Files:**
- Modify: `worker/src/services/hyperframes/index.ts`
- Modify: `worker/src/workers/merge.worker.ts`
- Modify: `worker/scripts/test-promotional-scenes.ts`
- Modify: `worker/scripts/test-hyperframes-composition.ts`

- [ ] **Step 1: Write failing merge and render tests**

In `worker/scripts/test-promotional-scenes.ts`, add `styleId: 'warm_editorial'` to the first step metadata JSON:

```ts
      styleId: 'warm_editorial',
```

Add:

```ts
assert.equal(scenes[0]?.styleId, 'warm_editorial')
assert.equal(scenes[1]?.styleId, 'auto')
```

In `worker/scripts/test-hyperframes-composition.ts`, add `styleId: 'technical_dark'` to the first scene passed to `renderPromotionalVideo`, then add:

```ts
  assert.ok(html.includes('style-technical-dark'), 'manual styles should produce a stable root style class')
  assert.ok(html.includes('data-video-style="technical_dark"'), 'composition should expose the selected video style')
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd worker && npx tsx scripts/test-promotional-scenes.ts
```

Expected: FAIL because `styleId` is not mapped.

Run:

```bash
cd worker && npx tsx scripts/test-hyperframes-composition.ts
```

Expected: FAIL because HyperFrames does not emit style classes or data attributes.

- [ ] **Step 3: Extend HyperFrames scene type**

In `worker/src/services/hyperframes/index.ts`, import:

```ts
import { getVideoStyleDescriptor, normalizeVideoStyleId, type VideoStyleId } from '../video-styles'
```

Add this property to `PromotionalScene`:

```ts
  styleId?: VideoStyleId | null
```

- [ ] **Step 4: Compute style class and data attribute**

In `createPromotionalHtml`, after `productClass`, add:

```ts
  const selectedStyleId = normalizeVideoStyleId(scenes.find(scene => scene.styleId)?.styleId)
  const styleDescriptor = getVideoStyleDescriptor(selectedStyleId)
  const styleClass = styleDescriptor.className
```

Change the `<body>` and `#root` lines to:

```ts
<body class="${productClass} ${styleClass}" data-video-style="${selectedStyleId}">
<div id="root" class="${productClass} ${styleClass}" data-video-style="${selectedStyleId}" data-composition-id="root" data-start="0" data-width="${WIDTH}" data-height="${HEIGHT}" data-duration="${formatDuration(totalDuration)}" data-fps="${FPS}">
```

- [ ] **Step 5: Add style-specific CSS tokens**

Inside `:root`, after `--dark`, add:

```css
      --style-surface: #f7faff;
      --style-accent: var(--brand-primary);
      --style-ink: #061226;
      --style-muted: #53657d;
```

Add these CSS branches before `* { box-sizing: border-box; }`:

```css
    .style-bold-launch {
      --style-surface: #fff7ed;
      --style-accent: #f97316;
      --style-ink: #111827;
      --style-muted: #4b5563;
    }
    .style-warm-editorial {
      --style-surface: #fff7ed;
      --style-accent: #7c3a12;
      --style-ink: #3f2415;
      --style-muted: #6b4e3d;
    }
    .style-technical-dark {
      --style-surface: #020817;
      --style-accent: #38bdf8;
      --style-ink: #f8fafc;
      --style-muted: #94a3b8;
    }
    .style-premium-minimal {
      --style-surface: #fafaf9;
      --style-accent: #18181b;
      --style-ink: #18181b;
      --style-muted: #71717a;
    }
    .style-creator-social {
      --style-surface: #fdf2f8;
      --style-accent: #db2777;
      --style-ink: #1f2937;
      --style-muted: #6b7280;
    }
```

Change `#root` background to use `var(--style-surface)`:

```css
      background: var(--style-surface);
```

Add:

```css
    .style-technical-dark #root {
      background: #020817;
    }
    .style-technical-dark .topbar,
    .style-technical-dark .code-card {
      color: #e5eefb;
    }
    .style-bold-launch h1,
    .style-bold-launch h2 {
      letter-spacing: 0;
    }
```

- [ ] **Step 6: Map style metadata in merge worker**

In `worker/src/workers/merge.worker.ts`, import:

```ts
import { normalizeVideoStyleId, type VideoStyleId } from '../services/video-styles'
```

Add `video_style: string | null` to `PromotionalDemoMetadata`.

Add `styleId?: VideoStyleId | null` to `PromotionalStepMetadata`.

In `parsePromotionalStepMetadata`, add:

```ts
      styleId: normalizeVideoStyleId(parsed.styleId),
```

In `buildPromotionalScenes`, add:

```ts
  const demoStyleId = normalizeVideoStyleId(input.demo.video_style)
```

In the returned scene object, add:

```ts
      styleId: metadata.styleId ?? demoStyleId,
```

When selecting the demo row for promotional rendering, include:

```ts
        video_style: demos.video_style,
```

In the fallback demo metadata object, add:

```ts
          video_style: null,
```

- [ ] **Step 7: Run merge and HyperFrames tests**

Run:

```bash
cd worker && npx tsx scripts/test-promotional-scenes.ts
cd worker && npx tsx scripts/test-hyperframes-composition.ts
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add worker/src/services/hyperframes/index.ts worker/src/workers/merge.worker.ts worker/scripts/test-promotional-scenes.ts worker/scripts/test-hyperframes-composition.ts
git commit -m "feat: apply video style in renderer"
```

---

### Task 7: Full Verification

**Files:**
- No production file changes expected.

- [ ] **Step 1: Run web tests**

Run:

```bash
cd web && npm run test:security
```

Expected: PASS. Confirm output includes:

```text
plan capability tests passed
tts schema tests passed
```

- [ ] **Step 2: Run worker tests**

Run:

```bash
cd worker && npm run test:security
```

Expected: PASS. Confirm output includes:

```text
openai-compatible scene tests passed
promotional scene mapping tests passed
hyperframes composition tests passed
```

- [ ] **Step 3: Build web**

Run:

```bash
cd web && npm run build
```

Expected: PASS with a completed Next.js build and no TypeScript errors.

- [ ] **Step 4: Build worker**

Run:

```bash
cd worker && npm run build
```

Expected: PASS with TypeScript compilation completing successfully.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intentional modified files, or no changes if all implementation commits were made.

- [ ] **Step 6: Final commit for verification adjustments**

If verification required small fixes, commit them:

```bash
git add web worker database docs
git commit -m "test: verify video style selection"
```

If there are no uncommitted changes, skip this commit and report the clean status.

---

## Self-Review Against Spec

- Spec requires `auto` for all plans: Task 1 and Task 3 implement and test this.
- Spec requires Starter partial manual styles and Pro full styles: Task 1 implements and tests this.
- Spec requires persistence: Task 2 adds DB schema and migration; Task 3 persists API input.
- Spec requires create form visibility and locking: Task 4 adds selector, lock labels, and source tests.
- Spec requires parser propagation and fallback/AI behavior: Task 5 extends parser input, prompt, metadata, and tests.
- Spec requires merge/rendering usage: Task 6 maps metadata into scenes and emits style classes/tokens.
- Spec requires compatibility with old demos and steps: Task 5 and Task 6 normalize missing values to `auto`.
- Spec requires current audio safeguards remain intact: Task 7 runs the existing worker security tests that include audio-required merge checks.
