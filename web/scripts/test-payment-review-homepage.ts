import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { en } from '../src/locales/en'
import { zh } from '../src/locales/zh'

const projectRoot = path.resolve(__dirname, '..')

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
  return []
}

function assertReviewReadyHome(locale: typeof zh, expected: {
  toolPositioning: RegExp
  demoOutput: RegExp
  pricing: RegExp
  deliverables: RegExp[]
  forbiddenInternalCopy: RegExp
}) {
  const homeCopy = collectStrings(locale.home).join(' ')

  assert.match(homeCopy, expected.toolPositioning, 'home copy should define Showrunner as a specific tool')
  assert.match(homeCopy, expected.demoOutput, 'home copy should show a concrete example output')
  assert.match(homeCopy, expected.pricing, 'home copy should make pricing visible before checkout')

  for (const deliverable of expected.deliverables) {
    assert.match(homeCopy, deliverable, `home copy should describe deliverable: ${deliverable}`)
  }

  assert.doesNotMatch(
    homeCopy,
    /ecosystem|future of storytelling|revolutionize storytelling|creative platform/i,
    'home copy should avoid high-risk platform positioning',
  )
  assert.doesNotMatch(
    homeCopy,
    expected.forbiddenInternalCopy,
    'home copy should not expose payment-review or risk-review wording to customers',
  )
}

assertReviewReadyHome(en, {
  toolPositioning: /AI short video script generator/i,
  demoOutput: /Example output/i,
  pricing: /View pricing/i,
  deliverables: [/script/i, /storyboard/i, /narration/i, /share page/i],
  forbiddenInternalCopy: /reviewer|reviewers|payment review|risk review|risk team/i,
})

assertReviewReadyHome(zh, {
  toolPositioning: /AI 短视频脚本生成工具/,
  demoOutput: /样例输出/,
  pricing: /查看定价/,
  deliverables: [/脚本/, /分镜/, /旁白/, /分享页/],
  forbiddenInternalCopy: /审核员|审核|风控|过审|支付审核/,
})

const homePageSource = fs.readFileSync(path.join(projectRoot, 'src/app/page.tsx'), 'utf8')
const layoutSource = fs.readFileSync(path.join(projectRoot, 'src/app/layout.tsx'), 'utf8')

assert.match(homePageSource, /href="\/pricing"/, 'home page should link directly to pricing')
assert.match(homePageSource, /exampleOutput/, 'home page should render a concrete example output section')
assert.match(homePageSource, /reviewChecklist/, 'home page should render review-friendly commercial details')
assert.match(layoutSource, /Short Video Script Generator/, 'metadata title should use the lower-risk tool positioning')
assert.match(layoutSource, /script, storyboard, and shareable draft/i, 'metadata description should describe concrete deliverables')

console.log('payment review homepage tests passed')
