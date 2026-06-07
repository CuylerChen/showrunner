import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateNarration, resolveTtsConfig } from '../src/services/tts'
import type { Step } from '../src/types'

const keys = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_TTS_API_KEY',
  'OPENAI_TTS_BASE_URL',
  'OPENAI_TTS_MODEL',
  'OPENAI_TTS_VOICE',
  'OPENAI_TTS_SPEED',
  'OPENAI_TTS_INSTRUCTIONS',
  'TTS_PROVIDER',
] as const

const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]))
const originalFetch = globalThis.fetch

async function withEnv<T>(
  env: Partial<Record<typeof keys[number], string | undefined>>,
  fn: () => T | Promise<T>,
): Promise<T> {
  for (const key of keys) delete process.env[key]
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value
  }

  try {
    return await fn()
  } finally {
    for (const key of keys) {
      const original = originalEnv[key]
      if (original === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    }
  }
}

async function main() {
  await withEnv({
    OPENAI_API_KEY: 'gateway-key',
    OPENAI_BASE_URL: 'https://gateway.example.com/v1',
    TTS_PROVIDER: 'auto',
  }, () => {
    const config = resolveTtsConfig()
    assert.equal(config.provider, 'kokoro')
    assert.equal(config.openai, undefined)
  })

  await withEnv({
    OPENAI_TTS_API_KEY: 'tts-key',
    OPENAI_TTS_BASE_URL: 'https://api.openai.com/v1/',
    OPENAI_TTS_MODEL: 'gpt-4o-mini-tts',
    OPENAI_TTS_VOICE: 'coral',
    OPENAI_TTS_SPEED: '0.9',
    OPENAI_TTS_INSTRUCTIONS: 'Warm product demo voice',
  }, () => {
    const config = resolveTtsConfig()
    assert.equal(config.provider, 'openai')
    assert.equal(config.openai?.apiKey, 'tts-key')
    assert.equal(config.openai?.baseUrl, 'https://api.openai.com/v1')
    assert.equal(config.openai?.model, 'gpt-4o-mini-tts')
    assert.equal(config.openai?.voice, 'coral')
    assert.equal(config.openai?.speed, 0.9)
    assert.equal(config.openai?.instructions, 'Warm product demo voice')
  })

  await withEnv({
    TTS_PROVIDER: 'kokoro',
    OPENAI_TTS_API_KEY: 'tts-key',
  }, () => {
    const config = resolveTtsConfig()
    assert.equal(config.provider, 'kokoro')
    assert.equal(config.openai, undefined)
  })

  await withEnv({
    OPENAI_API_KEY: 'gateway-key',
    OPENAI_BASE_URL: 'https://gateway.example.com/v1',
    OPENAI_TTS_API_KEY: 'tts-key',
    OPENAI_TTS_BASE_URL: 'https://tts.example.com/v1/',
    OPENAI_TTS_MODEL: 'gpt-4o-mini-tts',
    OPENAI_TTS_VOICE: 'coral',
  }, async () => {
    const outputDir = path.join(os.tmpdir(), `showrunner-tts-test-${Date.now()}`)
    let requestedUrl = ''
    let requestedAuthorization = ''
    let requestedBody: Record<string, unknown> | null = null

    globalThis.fetch = (async (url, init) => {
      requestedUrl = String(url)
      requestedAuthorization = String((init?.headers as Record<string, string>)?.Authorization ?? '')
      requestedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      return new Response(Buffer.from('fake mp3 bytes'), { status: 200 })
    }) as typeof fetch

    const steps: Step[] = [{
      id: 's1',
      position: 1,
      title: 'Intro',
      action_type: 'wait',
      selector: null,
      value: null,
      narration: 'A concise product demo narration.',
      wait_for_selector: null,
    }]

    try {
      const result = await generateNarration(steps, outputDir)
      assert.equal(requestedUrl, 'https://tts.example.com/v1/audio/speech')
      assert.equal(requestedAuthorization, 'Bearer tts-key')
      assert.equal(requestedBody?.model, 'gpt-4o-mini-tts')
      assert.equal(result.audioPaths[0], path.join(outputDir, 'step_1.mp3'))
    } finally {
      globalThis.fetch = originalFetch
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
  })
}

main().then(() => {
  console.log('tts config tests passed')
}).catch(err => {
  globalThis.fetch = originalFetch
  throw err
})
