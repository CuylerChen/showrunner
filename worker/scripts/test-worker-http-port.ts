import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const source = fs.readFileSync(path.join(appRoot, 'src/index.ts'), 'utf8')

assert.match(source, /function resolveWorkerPort\(\)/, 'worker should resolve its HTTP port from WORKER_PORT')
assert.match(source, /function resolveWorkerHost\(\)/, 'worker should resolve its HTTP host from WORKER_HOST')
assert.match(source, /process\.env\.WORKER_PORT/, 'worker should read WORKER_PORT from the environment')
assert.match(source, /process\.env\.WORKER_HOST/, 'worker should read WORKER_HOST from the environment')
assert.match(source, /startHttpServer\(resolveWorkerPort\(\),\s*resolveWorkerHost\(\)\)/, 'worker should start HTTP server on the resolved port and host')
assert.doesNotMatch(source, /startHttpServer\(3001\)/, 'worker must not hard-code port 3001')

const httpServerSource = fs.readFileSync(path.join(appRoot, 'src/http-server.ts'), 'utf8')
assert.match(httpServerSource, /startHttpServer\(port = 3001,\s*host = '127\.0\.0\.1'\)/, 'worker HTTP server should default to localhost')
assert.doesNotMatch(httpServerSource, /server\.listen\(port,\s*'0\.0\.0\.0'/, 'worker HTTP server must not bind all interfaces by default')

console.log('worker HTTP port config tests passed')
