import assert from 'node:assert/strict'
import {
  databaseUnavailableMessage,
  isDatabaseConnectionError,
} from '../src/lib/db/errors'

assert.equal(isDatabaseConnectionError({ code: 'ECONNREFUSED' }), true)
assert.equal(isDatabaseConnectionError({
  cause: { code: 'ECONNREFUSED' },
}), true)
assert.equal(isDatabaseConnectionError({
  cause: { cause: { code: 'ETIMEDOUT' } },
}), true)
assert.equal(isDatabaseConnectionError(new Error('validation failed')), false)
assert.match(databaseUnavailableMessage, /MySQL/)

console.log('db error tests passed')
