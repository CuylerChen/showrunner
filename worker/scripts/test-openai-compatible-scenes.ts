import assert from 'node:assert/strict'
import { generateProductStoryScenes } from '../src/services/parser/scenes'
import type { ScreenshotAsset } from '../src/services/parser/assets'

const originalFetch = globalThis.fetch
const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}

process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.OPENAI_BASE_URL = 'https://gateway.example.com/v1/'
process.env.OPENAI_MODEL = 'custom-compatible-model'

let requestedUrl = ''
let requestedBody: Record<string, unknown> | null = null
let requestedAuthorization = ''

globalThis.fetch = (async (url, init) => {
  requestedUrl = String(url)
  requestedAuthorization = String((init?.headers as Record<string, string>)?.Authorization ?? '')
  requestedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>

  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          scenes: [
            {
              title: 'Hook',
              narration: 'Show the product promise clearly for the target customer.',
              visual_type: 'screenshot',
              visual_role: 'home',
            },
            {
              title: 'CTA',
              narration: 'Invite viewers to take the next step with confidence.',
              visual_type: 'cta',
            },
          ],
        }),
      },
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}) as typeof fetch

const assets: ScreenshotAsset[] = [{
  url: 'https://example.com',
  role: 'home',
  localPath: '/tmp/home.png',
  publicUrl: '/videos/demo/assets/home.png',
}]

async function main() {
  const scenes = await generateProductStoryScenes({
    productUrl: 'https://example.com',
    description: 'Example product',
    sourceSummary: 'Example source summary',
  }, assets)

  assert.equal(requestedUrl, 'https://gateway.example.com/v1/chat/completions')
  assert.equal(requestedAuthorization, 'Bearer test-openai-key')
  assert.equal(requestedBody?.model, 'custom-compatible-model')
  assert.equal(scenes.length, 2)
  assert.equal(scenes[0]?.visual_asset_url, '/videos/demo/assets/home.png')
}

main().finally(() => {
  globalThis.fetch = originalFetch
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY
  process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL
}).then(() => {
  console.log('openai-compatible scene tests passed')
})
