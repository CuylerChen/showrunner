import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { zh } from '../src/locales/zh'
import { en } from '../src/locales/en'

const projectRoot = path.resolve(__dirname, '..')

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

assert.equal(zh.nav.pricing, '定价')
assert.equal(en.nav.pricing, 'Pricing')

assert.equal(
  fs.existsSync(path.join(projectRoot, 'src/app/pricing/page.tsx')),
  true,
  'pricing page should exist at /pricing',
)

const proxySource = readSource('src/proxy.ts')
assert.match(proxySource, /'\/pricing'/, '/pricing should be publicly accessible')

const homeSource = readSource('src/app/page.tsx')
assert.match(homeSource, /MarketingNav/, 'home page should render the marketing navigation')
assert.doesNotMatch(
  homeSource,
  /pricingPlans\.map/,
  'home page should not render pricing cards after pricing is standalone',
)

const navSource = readSource('src/components/marketing-nav.tsx')
assert.match(navSource, /href="\/pricing"/, 'marketing navigation should link to /pricing')

const pricingSource = readSource('src/app/pricing/page.tsx')
assert.match(pricingSource, /PricingSection/, 'pricing page should render the shared pricing section')
assert.match(pricingSource, /generateMetadata/, 'pricing page should provide localized metadata')

console.log('pricing page tests passed')
