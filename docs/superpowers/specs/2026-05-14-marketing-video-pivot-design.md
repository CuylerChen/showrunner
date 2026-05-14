# Showrunner Marketing Video Pivot Design

## Decision

Showrunner's primary product direction is now automatic marketing video generation, not automatic recording of real product operations.

The MVP should generate a polished Product Story video from a product URL and optional marketing inputs. The output is a shareable video with narration, website visuals when available, motion graphics fallback, scene navigation, and a CTA.

## Product Scope

### User Input

The creation form uses a short form:

- `product_url` is required.
- `audience` is optional.
- `key_points` is optional.
- `brand_tone` is optional.
- `cta_text` is optional.
- `cta_url` is optional.

The user can still create a video with only a URL. Optional fields improve script quality, scene relevance, and the final CTA.

### Default Video Structure

The default video format is Product Story:

1. Hook: name the pain or opportunity.
2. Problem: describe the audience's current friction.
3. Product value: explain how the product helps.
4. Benefit scenes: show 2-3 key benefits using website screenshots when available.
5. CTA: close with the requested next step.

The target length is 60-90 seconds, with 5-7 scenes.

### Visual Strategy

Use a hybrid visual strategy:

- Prefer website screenshots and page fragments for concrete product context.
- Wrap screenshots in HyperFrames-rendered motion design.
- Fall back to template graphics when screenshots fail or are not useful.

This keeps the generated video stable while making successful runs feel connected to the real product.

## Architecture

The existing service split remains:

- `web`: Next.js UI, API routes, auth, short form, scene review, share page.
- `worker`: BullMQ consumers for parsing, narration, and rendering.
- MySQL: users, subscriptions, demos, scene rows, job history.
- Redis: BullMQ queue storage.
- R2 or local `/videos`: final video storage.

The main workflow is:

```text
POST /api/demos
  -> create demos row
  -> enqueue parse-queue

parse.worker
  -> fetch website text
  -> capture useful website screenshots
  -> generate Product Story scenes with AI
  -> bind screenshots or template visuals to scenes
  -> write steps rows
  -> set demo.status = review

POST /api/demos/[id]/start
  -> enqueue tts-queue with renderMode = promotional
  -> set demo.status = processing

tts.worker
  -> generate narration audio per scene
  -> calculate scene timestamps from audio duration
  -> enqueue merge-queue

merge.worker
  -> render Product Story video with HyperFrames
  -> upload to R2 or local video storage
  -> update timestamps
  -> set demo.status = completed
```

The old real-browser recording path is no longer part of the primary product flow. `record-queue`, login-session APIs, and recorder services can remain temporarily for compatibility, but UI and new work should not depend on them.

## Data Model

Use the current `demos` table as the marketing video record. Add fields:

- `audience text null`
- `key_points text null`
- `brand_tone varchar(80) null`
- `source_summary text null`
- `thumbnail_url text null`

Existing fields remain useful:

- `product_url`
- `description`
- `cta_text`
- `cta_url`
- `video_url`
- `duration`
- `share_token`
- `status`
- `error_message`

Use the current `steps` table as scene storage for the first migration. Its semantic meaning changes from operation step to video scene. Add fields:

- `visual_type enum('screenshot','template','cta')`
- `visual_asset_url text null`

Continue using:

- `position`
- `title`
- `narration`
- `timestamp_start`
- `timestamp_end`
- `status`

Legacy fields such as `action_type`, `selector`, `value`, and `wait_for_selector` stay for compatibility but are not used by the marketing video path.

## API Design

### `POST /api/demos`

Accept the short form payload:

```json
{
  "product_url": "https://example.com",
  "description": "Optional notes",
  "audience": "Sales teams",
  "key_points": "Automates follow-up, improves conversion",
  "brand_tone": "confident",
  "cta_text": "Book a demo",
  "cta_url": "https://example.com/demo"
}
```

Validate URL and length limits, create the demo row, decrement quota, and enqueue `parse-queue`.

### `GET /api/demos/[id]`

Return demo metadata, short form fields, status, final video URL, and ordered scenes.

### `PATCH /api/demos/[id]/steps/[stepId]`

Allow editing scene title, narration, position, and optional visual choice. The route should enforce demo ownership.

### `POST /api/demos/[id]/start`

Require `status = review`, load ordered scenes, set `status = processing`, and enqueue `tts-queue` with `renderMode = promotional`.

### Share Routes

Keep `/share/[token]` and `/api/share/[token]`, but update labels and content from demo walkthrough language to marketing video language.

## Worker Design

### Parser

The parser should:

- Fetch the home page and useful same-origin pages such as features, product, solutions, pricing, customers, and about.
- Extract title, description, headings, and readable text.
- Capture screenshots for the most useful pages with Playwright.
- Ask the AI model for a Product Story plan with 5-7 scenes.
- Map scenes to screenshots by page role when possible.
- Fall back to template visuals if screenshot capture fails.

The AI output should be normalized to:

```json
{
  "position": 1,
  "title": "Scene title",
  "narration": "Voiceover text",
  "visual_type": "screenshot",
  "visual_asset_url": "/videos/demo-id/assets/home.png"
}
```

### TTS

Keep one audio file per scene. Use measured audio duration to calculate timestamps. Silent fallback can remain for development, but production failures should be visible in `error_message` after retries.

### Render

`merge.worker` should use the promotional render path for this product mode. The HyperFrames template should support:

- Website screenshot stage.
- Scene title.
- Narration caption.
- Product Story progress.
- CTA closing scene.
- Brand tone variants.
- Template fallback for missing screenshots.

The old recording merge path should not be called from the new start route.

## Error Handling

- Website text fetch fails: continue from user-provided short form fields and generic fallback story.
- Screenshot capture fails: use template visuals for affected scenes.
- AI generation fails: retry; if retries fail, use deterministic fallback scenes when enough input exists, otherwise mark the demo failed.
- TTS fails: retry; after final failure mark failed or use explicit silent fallback depending on environment.
- HyperFrames render fails: mark the demo failed and keep a clear error message. Do not fall back to the old recording merge path for the marketing video flow.
- R2 upload fails: fall back to local video storage if configured.

## UI Changes

- Creation form becomes a short marketing brief.
- Dashboard and detail pages should use "video", "scene", "script", and "marketing video" wording.
- Remove login-session and manual recording recovery controls from the main UI.
- Review page shows editable Product Story scenes, not click/fill operation steps.
- Completed page emphasizes download/share/CTA, not operation timeline recovery.

## Migration Strategy

Use a conservative migration:

1. Add marketing fields to existing tables.
2. Update schema definitions and MySQL initialization SQL so new environments match runtime code.
3. Update create/start APIs and parser/render workers for marketing video mode.
4. Remove recording-specific UI from the main path.
5. Keep recorder code and queue definitions temporarily unused.
6. After the marketing path is stable, delete or archive recorder-specific APIs, workers, docs, and schema fields.

## Testing

Minimum verification for the implementation:

- Typecheck/build both `web` and `worker`.
- Test `POST /api/demos` validation and quota handling for the short form.
- Test parser fallback when website fetch or screenshots fail.
- Test render payload when all scenes use template visuals.
- Run a manual smoke test: create video, reach review, start generation, complete video, open share page.

## Documentation Updates

Update product and architecture docs to reflect:

- Marketing video generation as the primary product.
- MySQL and self-managed JWT as the current implementation.
- BullMQ queues for parse, tts, and merge.
- HyperFrames as the main video renderer.
- Real-browser recording as deprecated or out of scope for the primary MVP.
