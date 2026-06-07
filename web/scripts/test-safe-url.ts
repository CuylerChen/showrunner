import assert from 'node:assert/strict'
import {
  isBlockedIpAddress,
  parseHttpUrl,
  validateUrlForUserInput,
} from '../src/lib/security/safe-url'

assert.equal(isBlockedIpAddress('127.0.0.1'), true)
assert.equal(isBlockedIpAddress('10.0.0.8'), true)
assert.equal(isBlockedIpAddress('172.16.0.1'), true)
assert.equal(isBlockedIpAddress('192.168.1.20'), true)
assert.equal(isBlockedIpAddress('169.254.169.254'), true)
assert.equal(isBlockedIpAddress('8.8.8.8'), false)
assert.equal(isBlockedIpAddress('::1'), true)

assert.equal(parseHttpUrl('https://example.com/path')?.href, 'https://example.com/path')
assert.equal(parseHttpUrl('ftp://example.com'), null)
assert.equal(parseHttpUrl('https://user:pass@example.com'), null)
assert.equal(validateUrlForUserInput('http://127.0.0.1:3000').ok, false)
assert.equal(validateUrlForUserInput('https://example.com').ok, true)

console.log('web safe-url tests passed')
