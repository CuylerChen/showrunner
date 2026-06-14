import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

const startRoute = read('src/app/api/demos/[id]/start/route.ts')
assert.match(startRoute, /try\s*{[\s\S]*ttsQueue\.add/, 'start route should wrap status update and TTS enqueue in a try block')
assert.match(startRoute, /catch\s*\([^)]*queueError[^)]*\)[\s\S]*status:\s*'review'/, 'start route should restore review status if TTS enqueue fails')
assert.match(startRoute, /catch\s*\([^)]*queueError[^)]*\)[\s\S]*START_FAILED/, 'start route should return a clear queue failure error')

const resolveRoute = read('src/app/api/demos/[id]/steps/[stepId]/resolve/route.ts')
assert.match(resolveRoute, /try\s*{[\s\S]*recordQueue\.add/, 'resolve route should wrap status update and record enqueue in a try block')
assert.match(resolveRoute, /catch\s*\([^)]*queueError[^)]*\)[\s\S]*status:\s*'paused'/, 'resolve route should restore paused status if record enqueue fails')
assert.match(resolveRoute, /catch\s*\([^)]*queueError[^)]*\)[\s\S]*RECORD_RETRY_FAILED/, 'resolve route should return a clear queue failure error')

const saveRoute = read('src/app/api/demos/[id]/login-session/save/route.ts')
assert.match(saveRoute, /try\s*{[\s\S]*parseQueue\.add/, 'save-session route should wrap DB update and parse enqueue in a try block')
assert.match(saveRoute, /catch\s*\([^)]*queueError[^)]*\)[\s\S]*status:\s*'failed'/, 'save-session route should mark the demo failed if reparse enqueue fails')
assert.match(saveRoute, /catch\s*\([^)]*queueError[^)]*\)[\s\S]*Failed to enqueue reparse job/, 'save-session route should return a clear reparse queue failure')

console.log('queue state rollback tests passed')
