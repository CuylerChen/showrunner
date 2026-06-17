import assert from 'node:assert/strict'
import { buildPromotionalScenes } from '../src/workers/merge.worker'
import type { Step } from '../src/types'

const steps: Step[] = [
  {
    id: 'step-1',
    position: 1,
    title: 'Hook',
    action_type: 'wait',
    selector: null,
    narration: 'Open with the product promise.',
    value: JSON.stringify({
      kicker: 'Office coffee',
      proofPoints: ['Weekly delivery', 'Roast preferences'],
      ctaHeadline: 'Order beans for next week',
      visualStyle: 'warm editorial',
      styleId: 'warm_editorial',
      brandColor: '#7C3A12',
      productType: 'ecommerce',
    }),
    visual_type: 'screenshot',
    visual_asset_url: '/videos/demo/assets/home.png',
    wait_for_selector: null,
  },
  {
    id: 'step-2',
    position: 2,
    title: 'CTA',
    action_type: 'wait',
    selector: null,
    value: null,
    narration: 'Invite users to start.',
    visual_type: 'cta',
    visual_asset_url: null,
    wait_for_selector: null,
  },
]

const scenes = buildPromotionalScenes({
  steps,
  audioPaths: ['/tmp/audio-one.mp3'],
  stepTimestamps: [
    { stepId: 'step-1', start: 0, end: 1.2 },
    { stepId: 'step-2', start: 1.2, end: 1.5 },
  ],
  demo: {
    title: null,
    product_url: 'https://sub.sharellm.uk/',
    cta_text: 'Start access',
    cta_url: 'https://sub.sharellm.uk/v1',
    brand_tone: 'clear and technical',
    video_style: null,
  },
})

assert.equal(scenes.length, 2)
assert.equal(scenes[0]?.brandName, 'sub.sharellm.uk')
assert.equal(scenes[0]?.ctaText, 'Start access')
assert.equal(scenes[0]?.ctaUrl, 'https://sub.sharellm.uk/v1')
assert.equal(scenes[0]?.brandTone, 'clear and technical')
assert.equal(scenes[0]?.kicker, 'Office coffee')
assert.deepEqual(scenes[0]?.proofPoints, ['Weekly delivery', 'Roast preferences'])
assert.equal(scenes[0]?.ctaHeadline, 'Order beans for next week')
assert.equal(scenes[0]?.visualStyle, 'warm editorial')
assert.equal(scenes[0]?.styleId, 'warm_editorial')
assert.equal(scenes[1]?.styleId, 'auto')
assert.equal(scenes[0]?.brandColor, '#7C3A12')
assert.equal(scenes[0]?.productType, 'ecommerce')
assert.equal(scenes[0]?.audioPath, '/tmp/audio-one.mp3')
assert.equal(scenes[0]?.duration, 2, 'short first timestamps should still use a readable minimum duration')
assert.equal(scenes[0]?.visualAssetPath, '/videos/demo/assets/home.png')
assert.equal(scenes[1]?.audioPath, undefined, 'missing audio paths should not become broken asset references')
assert.equal(scenes[1]?.duration, 2, 'short CTA timestamps should still use a readable minimum duration')

const titledScenes = buildPromotionalScenes({
  steps,
  audioPaths: [],
  stepTimestamps: [],
  demo: {
    title: 'ShareLLM',
    product_url: 'https://sub.sharellm.uk/',
    cta_text: null,
    cta_url: null,
    brand_tone: null,
    video_style: null,
  },
})

assert.equal(titledScenes[0]?.brandName, 'ShareLLM')
assert.equal(titledScenes[0]?.ctaUrl, 'https://sub.sharellm.uk/')

const fallbackScenes = buildPromotionalScenes({
  steps: [
    {
      ...steps[0],
      id: 'step-fallback',
      value: JSON.stringify({
        kicker: 'Fallback style',
      }),
    },
    {
      ...steps[1],
      id: 'step-invalid',
      value: JSON.stringify({
        styleId: 'not_a_real_style',
      }),
    },
  ],
  audioPaths: [],
  stepTimestamps: [],
  demo: {
    title: 'Fallback Demo',
    product_url: null,
    cta_text: null,
    cta_url: null,
    brand_tone: null,
    video_style: 'technical_dark',
  },
})

assert.equal(fallbackScenes[0]?.styleId, 'technical_dark', 'missing step style should use demo video_style')
assert.equal(fallbackScenes[1]?.styleId, 'auto', 'invalid step style should normalize to auto instead of falling back to demo style')

console.log('promotional scene mapping tests passed')
