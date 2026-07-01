import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')

const schemaSql = fs.readFileSync(path.join(repoRoot, 'database/schema.sql'), 'utf8')
const creemMigration = fs.readFileSync(path.join(repoRoot, 'database/migrations/20260701_creem_billing.sql'), 'utf8')

assert.match(
  schemaSql,
  /demos_limit\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1/i,
  'subscriptions.demos_limit must default to 1 in database/schema.sql',
)

assert.match(
  creemMigration,
  /ALTER\s+TABLE\s+subscriptions\s+MODIFY\s+COLUMN\s+demos_limit\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1/i,
  'Creem migration must change subscriptions.demos_limit default to 1',
)

assert.match(
  creemMigration,
  /UPDATE\s+subscriptions\s+SET\s+demos_limit\s*=\s*1\s+WHERE\s+plan\s*=\s*'free'\s+AND\s+demos_limit\s*=\s*3/i,
  'Creem migration must update existing free subscriptions from limit 3 to 1',
)

assert.match(schemaSql, /creem_subscription_id\s+VARCHAR\(64\)/i, 'database/schema.sql should include Creem subscription id')
assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS creem_events/i, 'database/schema.sql should include Creem webhook idempotency table')
assert.match(creemMigration, /creem_customer_id/i, 'Creem migration should add customer id')
assert.match(creemMigration, /CREATE TABLE IF NOT EXISTS creem_events/i, 'Creem migration should create webhook idempotency table')

console.log('subscription schema tests passed')
