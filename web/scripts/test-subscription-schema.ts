import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')

const schemaSql = fs.readFileSync(path.join(repoRoot, 'database/schema.sql'), 'utf8')
const paddleMigration = fs.readFileSync(path.join(repoRoot, 'database/migrations/20260614_paddle_subscriptions.sql'), 'utf8')

assert.match(
  schemaSql,
  /demos_limit\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1/i,
  'subscriptions.demos_limit must default to 1 in database/schema.sql',
)

assert.match(
  paddleMigration,
  /ALTER\s+TABLE\s+subscriptions\s+MODIFY\s+COLUMN\s+demos_limit\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1/i,
  'Paddle migration must change subscriptions.demos_limit default to 1',
)

assert.match(
  paddleMigration,
  /UPDATE\s+subscriptions\s+SET\s+demos_limit\s*=\s*1\s+WHERE\s+plan\s*=\s*'free'\s+AND\s+demos_limit\s*=\s*3/i,
  'Paddle migration must update existing free subscriptions from limit 3 to 1',
)

console.log('subscription schema tests passed')
