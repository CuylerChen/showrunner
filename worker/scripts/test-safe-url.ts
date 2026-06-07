import assert from 'node:assert/strict'
import {
  isBlockedIpAddress,
  parseHttpUrl,
  validateUrlForUserInput,
} from '../src/utils/safe-url'

assert.equal(isBlockedIpAddress('127.0.0.1'), true)
assert.equal(isBlockedIpAddress('10.1.2.3'), true)
assert.equal(isBlockedIpAddress('172.31.255.255'), true)
assert.equal(isBlockedIpAddress('192.168.0.1'), true)
assert.equal(isBlockedIpAddress('169.254.169.254'), true)
assert.equal(isBlockedIpAddress('1.1.1.1'), false)
assert.equal(isBlockedIpAddress('::1'), true)

assert.equal(parseHttpUrl('https://example.com')?.hostname, 'example.com')
assert.equal(parseHttpUrl('file:///etc/passwd'), null)
assert.equal(parseHttpUrl('https://user@example.com'), null)
assert.equal(validateUrlForUserInput('http://localhost').ok, true)
assert.equal(validateUrlForUserInput('http://127.0.0.1').ok, false)

console.log('worker safe-url tests passed')
