import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { en } from '../src/locales/en'
import { zh } from '../src/locales/zh'
import {
  ContentModerationError,
  assertPromptAllowedByCreem,
  composeDemoModerationPrompt,
  composeStepsModerationPrompt,
  resolveCreemModerationBaseUrl,
} from '../src/lib/moderation/creem'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDir, '..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(webRoot, relativePath), 'utf8')
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
  return []
}

function legalText(locale: typeof zh): string {
  return collectStrings(locale.legal).join(' ')
}

async function assertRejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(
    promise,
    (error) => error instanceof ContentModerationError && error.code === code,
  )
}

const originalEnv = {
  CREEM_API_KEY: process.env.CREEM_API_KEY,
  CREEM_API_BASE_URL: process.env.CREEM_API_BASE_URL,
  CREEM_MODERATION_TIMEOUT_MS: process.env.CREEM_MODERATION_TIMEOUT_MS,
}
const originalFetch = globalThis.fetch

async function main() {
  const enLegal = legalText(en)
  const zhLegal = legalText(zh)

  assert.doesNotMatch(enLegal, /showrunner@cuylerchen\.uk/, 'English legal copy should not use the old support email')
  assert.doesNotMatch(zhLegal, /showrunner@cuylerchen\.uk/, 'Chinese legal copy should not use the old support email')
  assert.match(enLegal, /chenkaileyxy@gmail\.com/, 'English legal copy should use store business support email')
  assert.match(zhLegal, /chenkaileyxy@gmail\.com/, 'Chinese legal copy should use store business support email')

  assert.match(enLegal, /OpenAI-compatible chat completion/i, 'English legal copy should disclose AI chat model/provider')
  assert.match(enLegal, /Kokoro|OpenAI-compatible TTS/i, 'English legal copy should disclose narration provider')
  assert.match(zhLegal, /OpenAI-compatible Chat Completions|OpenAI 兼容/i, 'Chinese legal copy should disclose AI chat model/provider')
  assert.match(zhLegal, /Kokoro|OpenAI-compatible TTS|OpenAI 兼容 TTS/i, 'Chinese legal copy should disclose narration provider')

  assert.match(enLegal, /NSFW|adult|sexually explicit/i, 'English terms should prohibit NSFW/adult/sexually explicit content')
  assert.match(zhLegal, /NSFW|成人|色情|性露骨/, 'Chinese terms should prohibit NSFW/adult/sexually explicit content')

  const legalPageSource = read('src/components/legal-page.tsx')
  assert.match(legalPageSource, /chenkaileyxy@gmail\.com/, 'legal page should auto-link the store support email')

  const envExample = read('.env.local.example')
  assert.match(envExample, /CREEM_API_KEY=/, 'env example should document CREEM_API_KEY')
  assert.match(envExample, /CREEM_API_BASE_URL=/, 'env example should document CREEM_API_BASE_URL')

  const apiSourceChecks = [
    ['src/app/api/demos/route.ts', /assertPromptAllowedByCreem\(/],
    ['src/app/api/demos/[id]/login-session/save/route.ts', /assertPromptAllowedByCreem\(/],
    ['src/app/api/demos/[id]/steps/route.ts', /assertPromptAllowedByCreem\(/],
    ['src/app/api/demos/[id]/start/route.ts', /assertPromptAllowedByCreem\(/],
    ['src/app/api/demos/[id]/steps/[stepId]/resolve/route.ts', /assertPromptAllowedByCreem\(/],
  ] as const
  for (const [relativePath, pattern] of apiSourceChecks) {
    assert.match(read(relativePath), pattern, `${relativePath} should screen prompts through Creem before generation`)
  }

  const routeSources = apiSourceChecks.map(([relativePath]) => read(relativePath)).join('\n')
  assert.match(routeSources, /handleContentModerationError/, 'routes should map moderation errors to API responses')
  const resolveRouteSource = read('src/app/api/demos/[id]/steps/[stepId]/resolve/route.ts')
  assert.match(
    resolveRouteSource,
    /composeStepsModerationPrompt\(remainingSteps\)/,
    'resolve route should screen remaining steps before record/TTS enqueue',
  )

  assert.equal(resolveCreemModerationBaseUrl({ CREEM_API_KEY: 'creem_live_123' }), 'https://api.creem.io')
  assert.equal(resolveCreemModerationBaseUrl({ CREEM_API_KEY: 'creem_test_123' }), 'https://test-api.creem.io')
  assert.equal(
    resolveCreemModerationBaseUrl({
      CREEM_API_KEY: 'creem_live_123',
      CREEM_API_BASE_URL: 'https://custom.example.com/',
    }),
    'https://custom.example.com',
  )

  const composedDemoPrompt = composeDemoModerationPrompt({
    product_url: 'https://example.com',
    description: 'launch a new analytics tool',
    audience: 'SaaS founders',
    key_points: 'faster setup',
    brand_tone: 'confident',
    cta_text: 'Start trial',
    cta_url: 'https://example.com/start',
  })
  assert.match(composedDemoPrompt, /Product URL: https:\/\/example\.com/)
  assert.match(composedDemoPrompt, /Description: launch a new analytics tool/)
  assert.match(composedDemoPrompt, /Key points: faster setup/)

  const composedStepsPrompt = composeStepsModerationPrompt([
    { title: 'Hook', narration: 'Explain the product clearly.' },
    { title: 'CTA', narration: null },
  ])
  assert.match(composedStepsPrompt, /Scene 1 title: Hook/)
  assert.match(composedStepsPrompt, /Scene 1 narration: Explain the product clearly\./)
  assert.match(composedStepsPrompt, /Scene 2 title: CTA/)

  process.env.CREEM_API_KEY = 'creem_live_test'
  process.env.CREEM_API_BASE_URL = 'https://api.creem.test/'
  process.env.CREEM_MODERATION_TIMEOUT_MS = '500'

  const moderationRequests: Array<{ url: string; headers: HeadersInit; body: string }> = []
  globalThis.fetch = (async (url, init) => {
    moderationRequests.push({
      url: String(url),
      headers: init?.headers ?? {},
      body: String(init?.body ?? ''),
    })
    return Response.json({
      id: 'mod_1',
      object: 'moderation_result',
      prompt: 'safe prompt',
      external_id: 'demo_1',
      decision: 'allow',
      usage: { units: 1 },
    })
  }) as typeof fetch

  await assertPromptAllowedByCreem('safe prompt', { externalId: 'demo_1' })
  const capturedRequest = moderationRequests[0]
  assert.ok(capturedRequest, 'moderation helper should call fetch')
  assert.equal(capturedRequest.url, 'https://api.creem.test/v1/moderation/prompt')
  assert.equal((capturedRequest.headers as Record<string, string>)['x-api-key'], 'creem_live_test')
  assert.deepEqual(JSON.parse(capturedRequest.body), { prompt: 'safe prompt', external_id: 'demo_1' })

  globalThis.fetch = (async () => Response.json({ decision: 'flag' })) as typeof fetch
  await assertRejectsWithCode(
    assertPromptAllowedByCreem('flagged prompt', { externalId: 'demo_2' }),
    'PROMPT_REJECTED',
  )

  globalThis.fetch = (async () => new Response('bad gateway', { status: 502 })) as typeof fetch
  await assertRejectsWithCode(
    assertPromptAllowedByCreem('safe prompt', { externalId: 'demo_3' }),
    'CONTENT_MODERATION_UNAVAILABLE',
  )

  delete process.env.CREEM_API_KEY
  await assertRejectsWithCode(
    assertPromptAllowedByCreem('safe prompt', { externalId: 'demo_4' }),
    'CONTENT_MODERATION_NOT_CONFIGURED',
  )
}

main()
  .then(() => {
    console.log('creem moderation compliance tests passed')
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    if (originalEnv.CREEM_API_KEY === undefined) delete process.env.CREEM_API_KEY
    else process.env.CREEM_API_KEY = originalEnv.CREEM_API_KEY
    if (originalEnv.CREEM_API_BASE_URL === undefined) delete process.env.CREEM_API_BASE_URL
    else process.env.CREEM_API_BASE_URL = originalEnv.CREEM_API_BASE_URL
    if (originalEnv.CREEM_MODERATION_TIMEOUT_MS === undefined) delete process.env.CREEM_MODERATION_TIMEOUT_MS
    else process.env.CREEM_MODERATION_TIMEOUT_MS = originalEnv.CREEM_MODERATION_TIMEOUT_MS
  })
