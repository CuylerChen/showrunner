import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { en } from '../src/locales/en'
import { zh } from '../src/locales/zh'

function legalText(locale: typeof zh): string {
  const terms = locale.legal.terms
  const privacy = locale.legal.privacy
  const refund = locale.legal.refund

  return [
    ...terms.intro,
    ...terms.sections.flatMap(section => [section.title, ...section.paragraphs, ...(section.items ?? [])]),
    ...privacy.intro,
    ...privacy.sections.flatMap(section => [section.title, ...section.paragraphs, ...(section.items ?? [])]),
    ...refund.intro,
    ...refund.sections.flatMap(section => [section.title, ...section.paragraphs, ...(section.items ?? [])]),
  ].join(' ')
}

function assertPaddleReviewCopy(locale: typeof zh, labels: {
  pricingPage: RegExp
  productDeliverables: RegExp[]
}) {
  const copy = legalText(locale)

  assert.match(copy, /costpilot/, 'legal copy should include the legal business name costpilot')
  assert.match(copy, /Paddle/, 'legal copy should describe Paddle payment processing')
  assert.match(copy, labels.pricingPage, 'terms should tell reviewers where pricing details are shown')

  for (const deliverable of labels.productDeliverables) {
    assert.match(copy, deliverable, `terms should describe product deliverable: ${deliverable}`)
  }
}

assertPaddleReviewCopy(en, {
  pricingPage: /pricing page/,
  productDeliverables: [/product-page analysis/, /AI-generated storyboards and scripts/, /hosted share pages/],
})

assertPaddleReviewCopy(zh, {
  pricingPage: /价格页面/,
  productDeliverables: [/产品页面分析/, /AI 生成分镜和脚本/, /托管分享页/],
})

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const legalPageSource = readFileSync(new URL('../src/components/legal-page.tsx', import.meta.url), 'utf8')

for (const href of ['/terms-of-service', '/privacy-policy', '/refund-policy']) {
  assert.match(homePageSource, new RegExp(`href="${href}"`), `home page should link ${href}`)
  assert.match(legalPageSource, new RegExp(`href="${href}"`), `legal pages should link ${href}`)
}

console.log('paddle domain review copy tests passed')
