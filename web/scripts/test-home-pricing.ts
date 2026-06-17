import assert from 'node:assert/strict'
import { zh } from '../src/locales/zh'
import { en } from '../src/locales/en'

function assertPricingCopy(locale: typeof zh, expected: {
  title: string
  plans: Array<{ name: string; price: string; period: string; quota: string; featureKeywords: string[] }>
}) {
  assert.equal(locale.home.pricingTitle, expected.title)
  assert.equal(locale.home.pricingPlans.length, expected.plans.length)

  for (const plan of expected.plans) {
    const actual = locale.home.pricingPlans.find(item => item.name === plan.name)
    assert.ok(actual, `missing pricing plan: ${plan.name}`)
    assert.equal(actual.price, plan.price)
    assert.equal(actual.period, plan.period)
    assert.equal(actual.quota, plan.quota)
    assert.ok(actual.features.length >= 2, `${plan.name} should describe at least two features`)
    const searchableCopy = [actual.description, ...actual.features].join(' ')
    for (const keyword of plan.featureKeywords) {
      assert.match(searchableCopy, new RegExp(keyword), `${plan.name} should mention ${keyword}`)
    }
  }
}

assertPricingCopy(zh, {
  title: '价格简单，随生成规模升级',
  plans: [
    { name: 'Free', price: '$0', period: '永久', quota: '1 条视频', featureKeywords: ['默认旁白', '智能匹配'] },
    { name: 'Starter', price: '$19.9', period: '/ 月', quota: '10 条视频 / 月', featureKeywords: ['整条视频', '语速', 'Clean SaaS'] },
    { name: 'Pro', price: '$59.9', period: '/ 月', quota: '无限视频', featureKeywords: ['完整视频风格库', '自定义音频', '优先生成'] },
  ],
})

assertPricingCopy(en, {
  title: 'Simple pricing that scales with output',
  plans: [
    { name: 'Free', price: '$0', period: 'forever', quota: '1 video', featureKeywords: ['default narrator', 'Smart-matched'] },
    { name: 'Starter', price: '$19.9', period: '/ month', quota: '10 videos / month', featureKeywords: ['Whole-video', 'speed', 'Clean SaaS'] },
    { name: 'Pro', price: '$59.9', period: '/ month', quota: 'Unlimited videos', featureKeywords: ['Full video style catalog', 'custom audio', 'priority'] },
  ],
})

console.log('home pricing tests passed')
