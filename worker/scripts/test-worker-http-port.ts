import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const source = fs.readFileSync(path.join(appRoot, 'src/index.ts'), 'utf8')

assert.match(source, /function resolveWorkerPort\(\)/, 'worker should resolve its HTTP port from WORKER_PORT')
assert.match(source, /process\.env\.WORKER_PORT/, 'worker should read WORKER_PORT from the environment')
assert.match(source, /startHttpServer\(resolveWorkerPort\(\)\)/, 'worker should start HTTP server on the resolved port')
assert.doesNotMatch(source, /startHttpServer\(3001\)/, 'worker must not hard-code port 3001')

console.log('worker HTTP port config tests passed')
