import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const routePath = path.join(appRoot, 'src/app/api/webhooks/paddle/route.ts')
const source = fs.readFileSync(routePath, 'utf8')

assert.match(
  source,
  /db\.transaction\s*\(\s*async\s+tx\s*=>\s*{[\s\S]*insertEventOnce\(tx,\s*event\)[\s\S]*tx\s*\.\s*update\(schema\.subscriptions\)/,
  'subscription webhooks must insert idempotency event and update subscription in one transaction',
)

const transactionStart = source.indexOf('db.transaction')
const subscriptionUpdate = source.indexOf('tx.update(schema.subscriptions)')
const transactionEventInsert = source.indexOf('insertEventOnce(tx, event)')
assert.ok(transactionStart >= 0, 'subscription webhook must use a transaction')
assert.ok(transactionEventInsert > transactionStart, 'event insert should happen inside the transaction')
assert.ok(subscriptionUpdate > transactionEventInsert, 'duplicate event guard should run before subscription update inside the transaction')

const oldTopLevelInsert = source.indexOf('const eventInsert = await insertEventOnce(event)')
assert.equal(oldTopLevelInsert, -1, 'subscription events must not be marked processed before subscription mutation succeeds')

console.log('paddle webhook idempotency tests passed')
