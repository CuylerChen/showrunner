# Tiered TTS Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Free, Starter, and Pro visibly different in product capability, then enforce TTS voice selection by plan in the local app flow.

**Architecture:** Add shared plan capability and voice catalog helpers in the Web app, persist demo-level and step-level TTS choices in MySQL, and pass those choices through the existing TTS queue to the Worker. The Worker resolves provider-specific voice IDs for OpenAI-compatible TTS and Kokoro while keeping the current default fallback behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle MySQL schema, BullMQ, Worker TypeScript, Kokoro/OpenAI-compatible TTS.

---

### Task 1: Plan Capability And Voice Catalog

**Files:**
- Create: `web/src/lib/plans.ts`
- Test: `web/scripts/test-plan-capabilities.ts`
- Modify: `web/package.json`

- [x] Add a pure capability helper with `PLAN_CAPABILITIES`, `TTS_VOICES`, `getPlanCapabilities(plan)`, `getAllowedTtsVoices(plan)`, `canUseVideoVoice(plan, voiceId)`, and `canUsePerSceneVoice(plan, voiceId)`.
- [x] Add tests proving Free only has the default voice, Starter can select a video-level voice, and Pro can use per-scene voices.
- [x] Add the test script to `web/package.json`.

### Task 2: Persist Demo And Scene Voice Choices

**Files:**
- Modify: `database/schema.sql`
- Create: `database/migrations/20260614_tiered_tts_capabilities.sql`
- Modify: `web/src/lib/db/schema.ts`
- Modify: `worker/src/utils/db.ts`
- Modify: `web/src/types/index.ts`
- Modify: `worker/src/types.ts`

- [x] Add `demos.tts_voice_id`, `demos.tts_speed`, and `steps.tts_voice_id`.
- [x] Add an idempotent migration for existing MySQL databases.
- [x] Update Web and Worker Drizzle schemas and TypeScript types.

### Task 3: Starter Video-Level TTS Voice Selection

**Files:**
- Modify: `web/src/components/demo/create-form.tsx`
- Modify: `web/src/app/api/demos/route.ts`
- Modify: `web/src/locales/zh.ts`
- Modify: `web/src/locales/en.ts`
- Test: `web/scripts/test-plan-capabilities.ts`

- [x] Render voice choices in the create form.
- [x] Lock non-default voices for Free, allow video-level voice choice for Starter and Pro.
- [x] Validate requested `tts_voice_id` against the current user's plan before inserting the demo.

### Task 4: Pro Per-Scene TTS Voice Selection

**Files:**
- Modify: `web/src/app/api/demos/[id]/route.ts`
- Modify: `web/src/app/api/demos/[id]/steps/route.ts`
- Modify: `web/src/app/api/demos/[id]/start/route.ts`
- Modify: `web/src/app/(dashboard)/demo/[id]/page.tsx`
- Modify: `web/src/locales/zh.ts`
- Modify: `web/src/locales/en.ts`

- [x] Load current subscription plan with demo detail data.
- [x] Render per-scene voice selects only for Pro users; non-Pro users see locked copy.
- [x] Validate step-level voice updates so only Pro can save non-default scene voice overrides.
- [x] Include demo-level voice settings in the TTS queue payload.

### Task 5: Worker TTS Voice Resolution

**Files:**
- Create: `worker/src/services/tts/voices.ts`
- Modify: `worker/src/services/tts/index.ts`
- Modify: `worker/src/workers/tts.worker.ts`
- Test: `worker/scripts/test-tts-voices.ts`
- Modify: `worker/package.json`

- [x] Add provider mappings for generic voice IDs to OpenAI and Kokoro voice IDs.
- [x] Let `generateNarration` accept video-level defaults and per-step overrides.
- [x] Pass selected provider voice into OpenAI `/audio/speech` and Kokoro `generate`.
- [x] Add worker tests for default, video-level, and per-scene voice resolution.

### Task 6: Verification

**Files:**
- Existing local test/build commands only.

- [x] Run the new targeted Web tests.
- [x] Run the new targeted Worker tests.
- [x] Run `npm run lint` in `web`.
- [x] Run `npm run build` in `web`.
- [x] Run `npm run build` in `worker`.
- [x] Do not run deployment tests or touch production servers without explicit instruction.
