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

function assertCreemLegalCopy(locale: typeof zh, labels: {
  pricingPage: RegExp
  productDeliverables: RegExp[]
  creemSupportEscalation: RegExp
}) {
  const copy = legalText(locale)

  assert.match(copy, /Showrunner/, 'legal copy should include the Showrunner brand name')
  assert.match(copy, /Creem/, 'legal copy should describe Creem payment processing')
  assert.match(copy, /merchant of record/i, 'legal copy should describe Creem as merchant of record')
  assert.match(copy, /sales tax|VAT|GST|税费|增值税|消费税/i, 'legal copy should describe tax handling')
  assert.match(copy, /invoice|发票/i, 'legal copy should describe invoice handling')
  assert.match(copy, /refund|退款/i, 'legal copy should describe refund handling')
  assert.match(copy, labels.creemSupportEscalation, 'refund policy should describe Creem support escalation')
  assert.match(copy, labels.pricingPage, 'terms should tell customers where pricing details are shown')
  assert.doesNotMatch(copy, /Paddle/, 'legal copy should no longer reference Paddle')

  for (const deliverable of labels.productDeliverables) {
    assert.match(copy, deliverable, `terms should describe product deliverable: ${deliverable}`)
  }
}

assertCreemLegalCopy(en, {
  pricingPage: /pricing page/,
  creemSupportEscalation: /7 days/,
  productDeliverables: [/product-page analysis/, /AI-generated storyboards and scripts/, /hosted share pages/],
})

assertCreemLegalCopy(zh, {
  pricingPage: /价格页面/,
  creemSupportEscalation: /7 天/,
  productDeliverables: [/产品页面分析/, /AI 生成分镜和脚本/, /托管分享页/],
})

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const legalPageSource = readFileSync(new URL('../src/components/legal-page.tsx', import.meta.url), 'utf8')

for (const href of ['/terms-of-service', '/privacy-policy', '/refund-policy']) {
  assert.match(homePageSource, new RegExp(`href="${href}"`), `home page should link ${href}`)
  assert.match(legalPageSource, new RegExp(`href="${href}"`), `legal pages should link ${href}`)
}

console.log('creem legal copy tests passed')
