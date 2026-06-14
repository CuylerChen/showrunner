import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..')

const result = spawnSync(process.execPath, [
  '--import',
  'tsx',
  '-e',
  "await import('./src/lib/queue.ts'); setTimeout(() => process.exit(0), 250)",
], {
  cwd: projectRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    REDIS_URL: 'redis://127.0.0.1:1',
  },
  timeout: 3000,
})

assert.equal(result.status, 0, result.stderr || result.stdout)
assert.doesNotMatch(result.stderr, /ECONNREFUSED|EPERM|Redis|ioredis/i, 'queue module import must not connect to Redis')
assert.doesNotMatch(result.stderr, /DEP0169|url\.parse/i, 'queue module import must not initialize deprecated ioredis URL parsing')

console.log('queue lazy initialization tests passed')
