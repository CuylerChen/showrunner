import assert from 'node:assert/strict'
import { generateProductStoryScenes } from '../src/services/parser/scenes'
import type { ScreenshotAsset } from '../src/services/parser/assets'
import { normalizeVideoStyleId } from '../src/services/video-styles'

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
              kicker: 'Office coffee',
              proof_points: ['Weekly delivery', 'Roast preferences'],
              visual_style: 'warm editorial',
              style_id: 'warm_editorial',
              product_type: 'ecommerce',
              visual_type: 'screenshot',
              visual_role: 'home',
            },
            {
              title: 'CTA',
              narration: 'Invite viewers to take the next step with confidence.',
              kicker: 'Next delivery',
              cta_headline: 'Order beans for next week',
              product_type: 'ecommerce',
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
  assert.equal(normalizeVideoStyleId('unknown_style'), 'auto')
  assert.equal(normalizeVideoStyleId('toString'), 'auto')
  assert.equal(normalizeVideoStyleId('constructor'), 'auto')

  const scenes = await generateProductStoryScenes({
    productUrl: 'https://example.com',
    description: 'Example product',
    brandName: 'Example Brand',
    brandColors: ['#2563EB', '#10B981'],
    productCategory: 'ecommerce',
    videoStyle: 'technical_dark',
    sourceSummary: 'Example source summary',
  }, assets)

  assert.equal(requestedUrl, 'https://gateway.example.com/v1/chat/completions')
  assert.equal(requestedAuthorization, 'Bearer test-openai-key')
  assert.equal(requestedBody?.model, 'custom-compatible-model')
  assert.match(JSON.stringify(requestedBody), /proof_points/)
  assert.match(JSON.stringify(requestedBody), /product_type/)
  assert.match(JSON.stringify(requestedBody), /ecommerce/)
  assert.match(JSON.stringify(requestedBody), /Example Brand/)
  assert.match(JSON.stringify(requestedBody), /#2563EB/)
  assert.match(JSON.stringify(requestedBody), /technical_dark/)
  assert.match(JSON.stringify(requestedBody), /Dark, code-forward technical style/)
  assert.equal(scenes.length, 2)
  assert.equal(scenes[0]?.visual_asset_url, '/videos/demo/assets/home.png')
  assert.equal(scenes[0]?.kicker, 'Office coffee')
  assert.deepEqual(scenes[0]?.proof_points, ['Weekly delivery', 'Roast preferences'])
  assert.equal(scenes[0]?.visual_style, 'warm editorial')
  assert.equal(scenes[0]?.product_type, 'ecommerce')
  assert.equal(scenes[0]?.style_id, 'technical_dark')
  assert.equal(scenes[1]?.style_id, 'technical_dark')
  assert.equal(scenes[1]?.cta_headline, 'Order beans for next week')

  delete process.env.OPENAI_API_KEY
  const fallbackScenes = await generateProductStoryScenes({
    productUrl: 'https://example.com',
    description: 'Example product',
    brandName: 'Example Brand',
    productCategory: 'developer_tool',
    videoStyle: 'technical_dark',
    sourceSummary: 'Example source summary',
  }, assets)

  assert.equal(fallbackScenes[0]?.style_id, 'technical_dark')
  assert.equal(fallbackScenes[0]?.visual_style, 'dark technical product story')
  assert.equal(fallbackScenes.at(-1)?.style_id, 'technical_dark')
  assert.equal(fallbackScenes.at(-1)?.visual_style, 'dark technical product story CTA')
}

main().finally(() => {
  globalThis.fetch = originalFetch
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY
  process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL
}).then(() => {
  console.log('openai-compatible scene tests passed')
})
