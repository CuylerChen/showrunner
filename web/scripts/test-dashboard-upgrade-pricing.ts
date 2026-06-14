import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zh } from '../src/locales/zh'
import { en } from '../src/locales/en'

type LocaleCopy = typeof zh
type PaidPlan = 'starter' | 'pro'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const upgradePanelSource = fs.readFileSync(
  path.join(root, 'src/components/subscription/upgrade-panel.tsx'),
  'utf8',
)

function assertUpgradePricing(
  locale: LocaleCopy,
  expected: Record<PaidPlan, { price: string; period: string; quota: string }>,
) {
  for (const plan of ['starter', 'pro'] as const) {
    const actual = locale.subscriptionPanel.upgradePlans[plan]
    assert.equal(actual.name, locale.subscriptionPanel.planName[plan])
    assert.equal(actual.price, expected[plan].price)
    assert.equal(actual.period, expected[plan].period)
    assert.equal(actual.quota, expected[plan].quota)

    const homePlan = locale.home.pricingPlans.find(item => item.name === actual.name)
    assert.ok(homePlan, `home pricing should include ${actual.name}`)
    assert.equal(actual.price, homePlan.price)
    assert.equal(actual.period, homePlan.period)
    assert.equal(actual.quota, homePlan.quota)
  }
}

assertUpgradePricing(zh, {
  starter: { price: '$19.9', period: '/ 月', quota: '10 条视频 / 月' },
  pro: { price: '$59.9', period: '/ 月', quota: '无限视频' },
})

assertUpgradePricing(en, {
  starter: { price: '$19.9', period: '/ month', quota: '10 videos / month' },
  pro: { price: '$59.9', period: '/ month', quota: 'Unlimited videos' },
})

assert.match(
  upgradePanelSource,
  /copy\.upgradePlans/,
  'UpgradePanel should render dashboard-specific upgrade pricing copy',
)
assert.match(
  upgradePanelSource,
  /upgradeOptions\.map/,
  'UpgradePanel should render upgrade options from structured plan data',
)

console.log('dashboard upgrade pricing tests passed')
