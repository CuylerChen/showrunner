# Showrunner Video Style Selection Design

Date: 2026-06-17
Status: Draft for user review

## Goal

Add video style control to Showrunner generation while keeping the default experience simple: every user gets automatic style matching, and paid users can manually choose a preset visual style before creating a marketing video.

## Product Scope

In scope:

- Add a controlled `video_style` option with `auto` as the default.
- Keep automatic style matching available to every plan.
- Unlock manual style selection for paid plans with tiered access:
  - Free: `auto` only.
  - Starter: `auto` plus selected manual styles.
  - Pro: all manual styles.
- Persist the selected style on the demo record.
- Pass the selected style through create API, parse queue, scene generation, merge mapping, and HyperFrames rendering.
- Make AI-generated and fallback scenes use the selected style consistently.
- Show locked styles in the create form without allowing locked choices to be submitted.
- Add focused tests for plan restrictions, API validation, parser propagation, scene mapping, and rendering metadata.

Out of scope:

- Free-form custom style prompts.
- Per-scene style selection.
- Uploading custom templates, fonts, images, LUTs, or motion packs.
- Retrofitting existing completed videos.
- A full template marketplace or style preview renderer.

## Style Catalog

Use a small enum-backed catalog so frontend, backend, workers, and tests agree on allowed values.

Initial styles:

- `auto`: Smart match. Available to all plans. The parser picks the best style from product category, brand tone, source material, and brand colors.
- `clean_saas`: Quiet, product-forward SaaS style. Starter and Pro.
- `bold_launch`: High-contrast launch and promo style. Starter and Pro.
- `warm_editorial`: Story-led editorial style for commerce, services, lifestyle, and content products. Starter and Pro.
- `technical_dark`: Dark, code-forward technical style. Pro.
- `premium_minimal`: Sparse, premium, restrained brand style. Pro.
- `creator_social`: Faster, creator-friendly social promo style. Pro.

The display labels and descriptions live in shared plan/style metadata rather than being duplicated ad hoc in components.

## Plan Rules

Plan capability helpers should expose style access in the same spirit as current TTS voice and speed controls:

- `getAllowedVideoStyles(plan)` returns the visible selectable catalog entries for a plan.
- `canUseVideoStyle(plan, styleId)` validates API access.
- `auto` always returns true.
- Starter allows `clean_saas`, `bold_launch`, and `warm_editorial`.
- Pro allows every style in the catalog.
- Unknown style IDs fail validation.

The API must enforce these rules independently from the UI so users cannot bypass locked styles by posting JSON directly.

## Data Model

Add `demos.video_style`:

- Type: `varchar(40) not null default 'auto'`.
- Migration should be idempotent using the existing migration helper pattern.
- Drizzle schemas in both web and worker DB utilities need the new column.
- Existing demos get `auto` through the default.

No new table is needed. Styles are application constants, not user-generated records.

## Create Flow

The create form adds a compact "Video style" control near the other generation controls.

Behavior:

- Default selected value is `auto`.
- Free users see manual styles as locked and cannot select them.
- Starter users can select Starter styles; Pro-only styles are visible but locked.
- Pro users can select all styles.
- On successful create, the form resets style back to `auto`.
- The POST body includes `video_style`.

The control should remain dense and work-focused. A select or segmented/list control is acceptable, but it should not become a large marketing-style card grid in the dashboard form.

## API Flow

`POST /api/demos` accepts:

```json
{
  "video_style": "auto"
}
```

Validation:

- Optional value defaults to `auto`.
- Value must be one of the catalog IDs.
- The authenticated user's plan must be allowed to use the requested style.
- Locked style requests return `PLAN_RESTRICTED`.
- Safe URL, quota, TTS voice, and TTS speed validation remain unchanged.

On successful creation:

- Insert `video_style` into `demos`.
- Add `videoStyle` to the parse queue payload.

Queue enqueue failure should keep existing rollback behavior: delete the demo and release reserved quota.

## Parser Flow

Extend parser input and parse job data with `videoStyle`.

For `auto`:

- The AI prompt asks the model to infer a suitable visual style from product category, source summary, brand tone, and brand colors.
- Fallback scenes continue to derive style from product category and brand tone.

For a manual style:

- The AI prompt states the selected style as a hard creative direction.
- The model still adapts copy and screenshots to the product, but should not switch to a different style family.
- Fallback scenes use style-specific `visual_style` strings.

Scene metadata in `steps.value` should include the resolved style ID in addition to existing `visualStyle`, `brandColor`, `productType`, and proof-point metadata. This keeps downstream rendering deterministic even if natural-language `visualStyle` varies.

## Merge And Rendering Flow

Extend promotional scene metadata with the resolved style ID.

`buildPromotionalScenes` should read the style ID from step metadata and pass it to HyperFrames. If metadata is absent, it falls back to the demo-level `video_style`, and then to `auto`.

HyperFrames should apply style at the template level:

- `auto`: current product-category driven behavior.
- `clean_saas`: light surfaces, restrained blue/green accent use, dashboard/product proof emphasis.
- `bold_launch`: stronger contrast, larger launch-style headlines, more energetic accent palette.
- `warm_editorial`: warmer surfaces and editorial composition, suitable for commerce/services/content.
- `technical_dark`: dark technical shell and code/product proof emphasis.
- `premium_minimal`: sparse layout, neutral surfaces, fewer chips, high whitespace.
- `creator_social`: sharper pacing, punchier scene treatment, social-friendly captions.

The first pass can implement these as style tokens and CSS class branches inside the existing promotional template. It should not introduce separate renderer files unless the current template becomes hard to reason about.

## Error Handling

- Unknown style: `VALIDATION_ERROR`.
- Locked style: `PLAN_RESTRICTED`.
- Missing `video_style` on existing rows: treat as `auto`.
- Missing style metadata in old steps: use demo-level style or `auto`.
- AI scene generation failure: fallback generation still uses the selected style.
- Render failure behavior remains unchanged; style selection must not weaken the current audio-required merge behavior.

## Testing

Use existing script-test patterns.

Web tests:

- Plan helpers return allowed style IDs for Free, Starter, and Pro.
- Create API rejects Free manual style.
- Create API rejects Starter Pro-only style.
- Create API accepts Starter style for Starter.
- Create API accepts Pro-only style for Pro.
- Create form sends `video_style`.
- Create form includes style locking UI checks in source-level tests.

Worker tests:

- Parser prompt/user message receives `videoStyle`.
- Fallback scenes include style-specific visual metadata.
- `productStorySceneMetadata` preserves resolved style ID.
- `buildPromotionalScenes` maps style metadata into promotional scenes.
- HyperFrames composition includes style-specific root class or style token.

Required verification after implementation:

```bash
cd web && npm run test:security
cd worker && npm run test:security
cd web && npm run build
cd worker && npm run build
```

## Migration And Compatibility

Existing demos and steps remain valid because `auto` is the default and downstream code falls back to `auto` when style metadata is missing.

The migration should not require backfilling historical rows beyond the column default. Previously completed videos keep their generated output unchanged.

## Acceptance Criteria

- A new demo can be created with no explicit style and behaves as `auto`.
- Free users cannot manually select or submit paid styles.
- Starter users can select Starter styles but not Pro-only styles.
- Pro users can select every style.
- The selected style is visible in the create flow, stored on the demo, passed through parsing, and available to rendering.
- Fallback generation and AI generation both respect manual styles.
- The renderer emits distinguishable style classes/tokens for manual styles.
- Existing audio-required merge safeguards remain intact.
