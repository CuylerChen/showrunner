import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderPromotionalVideo } from '../src/services/hyperframes'

const originalCwd = process.cwd()
const originalPath = process.env.PATH
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showrunner-hyperframes-'))
const fakeBinDir = path.join(tmpDir, 'bin')
const outputDir = path.join(tmpDir, 'output')
const fakeHyperframes = path.join(fakeBinDir, 'hyperframes')

fs.mkdirSync(fakeBinDir, { recursive: true })
fs.writeFileSync(fakeHyperframes, `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const outputIndex = process.argv.indexOf('--output')
if (outputIndex === -1 || !process.argv[outputIndex + 1]) {
  console.error('missing --output')
  process.exit(2)
}
const outputPath = process.argv[outputIndex + 1]
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, 'fake mp4')
`)
fs.chmodSync(fakeHyperframes, 0o755)

async function main() {
  process.chdir(tmpDir)
  process.env.PATH = `${fakeBinDir}${path.delimiter}${originalPath ?? ''}`

  const visualAssetPath = path.join(tmpDir, 'visual #asset.png')
  const firstAudioAssetPath = path.join(tmpDir, 'first.mp3')
  const audioAssetPath = path.join(tmpDir, 'audio #two.mp3')
  fs.writeFileSync(visualAssetPath, 'fake image')
  fs.writeFileSync(firstAudioAssetPath, 'fake audio one')
  fs.writeFileSync(audioAssetPath, 'fake audio')

  await renderPromotionalVideo([
    {
      title: 'First scene',
      narration: 'Narration one',
      audioPath: firstAudioAssetPath,
      duration: 1.5,
      visualType: 'template',
      brandName: 'ShareLLM',
      ctaUrl: 'https://sub.sharellm.uk/v1',
    },
    {
      title: 'Second scene',
      narration: 'Narration two',
      audioPath: audioAssetPath,
      duration: 2.25,
      visualType: 'cta',
      visualAssetPath,
      brandName: 'ShareLLM',
      ctaText: 'Start now',
      ctaUrl: 'https://sub.sharellm.uk/v1',
    },
  ], outputDir)

  const html = fs.readFileSync(path.join(outputDir, 'promo-hyperframes', 'index.html'), 'utf8')

  assert.match(html, /<div[^>]+id="root"[^>]+data-composition-id="root"/)
  assert.match(html, /data-start="0"/)
  assert.match(html, /data-width="1280"/)
  assert.match(html, /data-height="720"/)
  assert.match(html, /data-duration="3\.750"/)
  assert.doesNotMatch(html, /<body[^>]+data-duration=/)

  assert.match(html, /window\.__timelines\["root"\]/)
  assert.match(html, /createStaticTimeline\(3\.750\)/)
  assert.match(html, /class="clip film"/, 'promotional renderer should use the V2 single-film composition')
  assert.match(html, /class="brand-lockup"/, 'V2 template must expose a persistent brand lockup')
  assert.match(html, /class="browser/, 'V2 template should frame screenshots in browser-like surfaces')
  assert.match(html, /class="code-card"/, 'V2 template should include structured product explainer visuals')
  assert.match(html, /class="flow-card"/, 'V2 template should include lifecycle/value cards')
  assert.ok(html.includes('https://sub.sharellm.uk/v1'), 'V2 template should surface the final CTA URL')
  assert.doesNotMatch(html, /Product Video/, 'V2 template should not use the old generic scene label')
  assert.doesNotMatch(html, /scene-index/, 'V2 template should not use the old numbered-scene overlay')

  assert.match(html, /<section[^>]+id="film"[^>]+class="clip film"[^>]+data-start="0\.000"[^>]+data-duration="3\.750"/)
  assert.match(html, /<div[^>]+id="scene-1"[^>]+class="scene\s/)
  assert.match(html, /<div[^>]+id="scene-2"[^>]+class="scene\s/)
  assert.match(html, /<audio[^>]+data-start="0\.000"[^>]+data-duration="1\.500"/)
  assert.match(html, /<audio[^>]+data-start="1\.500"[^>]+data-duration="2\.250"/)
  assert.ok(html.includes('ShareLLM'), 'promotional video must support caller-provided brand names')
  assert.doesNotMatch(html, /Showrunner/, 'promotional video must not hard-code the Showrunner brand')
  assert.ok(html.includes('src="assets/audio-2.mp3"'), 'audio assets must be copied into the composition')
  assert.ok(html.includes('src="assets/visual-2.png"'), 'visual assets must be copied into the composition')
  assert.doesNotMatch(html, new RegExp(pathToFileURL(audioAssetPath).href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'audio must not reference external file URLs')
  assert.doesNotMatch(html, new RegExp(pathToFileURL(visualAssetPath).href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'visuals must not reference external file URLs')
  assert.ok(fs.existsSync(path.join(outputDir, 'promo-hyperframes', 'assets', 'audio-2.mp3')))
  assert.ok(fs.existsSync(path.join(outputDir, 'promo-hyperframes', 'assets', 'visual-2.png')))

  const genericOutputDir = path.join(tmpDir, 'generic-output')
  await renderPromotionalVideo([
    {
      title: 'Fresh beans delivered weekly',
      narration: 'Acme Coffee helps busy teams keep fresh coffee stocked without manual reorders.',
      duration: 2,
      visualType: 'screenshot',
      visualAssetPath,
      brandName: 'Acme Coffee',
      ctaText: 'Order beans',
      ctaHeadline: 'Order beans for next week',
      ctaUrl: 'https://acme.example/shop',
      brandTone: 'warm and practical',
      brandColor: '#7C3A12',
      kicker: 'Office coffee',
      proofPoints: ['Weekly delivery', 'Roast preferences'],
      visualStyle: 'warm editorial',
      productType: 'ecommerce',
    },
    {
      title: 'Choose the roast your team loves',
      narration: 'Customers can pick roast profiles, delivery cadence, and quantities for each office.',
      duration: 2,
      visualType: 'template',
      brandName: 'Acme Coffee',
      ctaText: 'Order beans',
      ctaUrl: 'https://acme.example/shop',
      brandTone: 'warm and practical',
      brandColor: '#7C3A12',
      kicker: 'Roast choices',
      proofPoints: ['Flexible cadence', 'Team preferences'],
      productType: 'ecommerce',
    },
    {
      title: 'Keep every kitchen ready',
      narration: 'The product story should focus on office coffee logistics, not software API setup.',
      duration: 2,
      visualType: 'template',
      brandName: 'Acme Coffee',
      ctaText: 'Order beans',
      ctaUrl: 'https://acme.example/shop',
      brandTone: 'warm and practical',
      brandColor: '#7C3A12',
      productType: 'ecommerce',
    },
    {
      title: 'Order beans for your next delivery',
      narration: 'Acme Coffee sends buyers directly to the shop when they are ready.',
      duration: 2,
      visualType: 'cta',
      brandName: 'Acme Coffee',
      ctaText: 'Order beans',
      ctaHeadline: 'Order beans for next week',
      ctaUrl: 'https://acme.example/shop',
      brandTone: 'warm and practical',
      brandColor: '#7C3A12',
      productType: 'ecommerce',
    },
  ], genericOutputDir)

  const genericHtml = fs.readFileSync(path.join(genericOutputDir, 'promo-hyperframes', 'index.html'), 'utf8')

  assert.ok(genericHtml.includes('Acme Coffee'), 'generic V2 template should use the requested product brand')
  assert.ok(genericHtml.includes('Fresh beans delivered weekly'), 'generic V2 template should use product-specific scene titles')
  assert.ok(genericHtml.includes('office coffee logistics'), 'generic V2 template should use product-specific narration')
  assert.ok(genericHtml.includes('https://acme.example/shop'), 'generic V2 template should use the product CTA URL')
  assert.ok(genericHtml.includes('--brand-primary: #7C3A12'), 'generic V2 template should use extracted brand color')
  assert.ok(genericHtml.includes('product-ecommerce'), 'V2 template should apply product-type-specific classes')
  assert.ok(genericHtml.includes('<span>Products</span><span>Checkout</span><span>Offer</span>'), 'ecommerce videos should use commerce-specific navigation labels')
  assert.ok(genericHtml.includes('Office coffee'), 'generic V2 template should use scene-specific kickers')
  assert.ok(genericHtml.includes('Weekly delivery'), 'generic V2 template should use proof points')
  assert.ok(genericHtml.includes('Order beans for next week'), 'generic V2 template should use CTA headlines')
  assert.match(genericHtml, /<div class="flow-card"><span class="num">01<\/span><b>Fresh beans delivered weekly<\/b>/)
  assert.match(genericHtml, /<div class="flow-card"><span class="num">02<\/span><b>Choose the roast your team loves<\/b>/)
  assert.doesNotMatch(genericHtml, /baseURL|apiKey|model:|OpenAI|GPT-5|API key/i, 'generic V2 template must not contain API-specific copy')
  assert.doesNotMatch(genericHtml, /Open with context|Use captured website|End with action/, 'generic V2 flow cards must not use fixed placeholder copy')
}

main().finally(() => {
  process.chdir(originalCwd)
  process.env.PATH = originalPath
  fs.rmSync(tmpDir, { recursive: true, force: true })
}).then(() => {
  console.log('hyperframes composition tests passed')
})
