import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function assertScopedJobUpdates(relativePath: string, workerType: string) {
  const source = read(relativePath)

  assert.match(source, /const jobId\s*=\s*crypto\.randomUUID\(\)/, `${workerType} worker should persist a stable DB job id`)
  assert.match(source, /id:\s*jobId/, `${workerType} worker should insert the stable DB job id`)
  assert.match(source, /update\(jobs\)[\s\S]*where\(eq\(jobs\.id,\s*jobId\)\)/, `${workerType} worker completion should update only its DB job row`)
  assert.match(
    source,
    new RegExp(`update\\(jobs\\)[\\s\\S]*where\\(and\\(\\s*eq\\(jobs\\.demo_id,\\s*demoId\\),\\s*eq\\(jobs\\.type,\\s*'${workerType}'\\),\\s*eq\\(jobs\\.status,\\s*'running'\\)`),
    `${workerType} worker failure should only update the running ${workerType} job row`,
  )
}

assertScopedJobUpdates('src/workers/parse.worker.ts', 'parse')
assertScopedJobUpdates('src/workers/record.worker.ts', 'record')
assertScopedJobUpdates('src/workers/tts.worker.ts', 'tts')
assertScopedJobUpdates('src/workers/merge.worker.ts', 'merge')

const recordWorker = read('src/workers/record.worker.ts')
const recordQueueAdd = recordWorker.indexOf("await ttsQueue.add('tts'")
const recordComplete = recordWorker.indexOf(".update(jobs)\n    .set({ status: 'completed'")
assert.ok(recordQueueAdd >= 0, 'record worker should enqueue TTS after recording')
assert.ok(recordComplete > recordQueueAdd, 'record worker should mark record job completed only after TTS enqueue succeeds')
assert.match(recordWorker, /TTS_QUEUE_FAILED/, 'record worker should persist a clear error when TTS enqueue fails')

const ttsWorker = read('src/workers/tts.worker.ts')
const ttsQueueAdd = ttsWorker.indexOf("await mergeQueue.add('merge'")
const ttsComplete = ttsWorker.indexOf(".update(jobs)\n    .set({ status: 'completed'")
assert.ok(ttsQueueAdd >= 0, 'tts worker should enqueue merge after narration generation')
assert.ok(ttsComplete > ttsQueueAdd, 'tts worker should mark TTS job completed only after merge enqueue succeeds')
assert.match(ttsWorker, /MERGE_QUEUE_FAILED/, 'tts worker should persist a clear error when merge enqueue fails')
assert.match(ttsWorker, /singleLongRunningWorkerOptions/, 'tts worker should use long lock settings for slow narration jobs')

const mergeWorker = read('src/workers/merge.worker.ts')
assert.match(mergeWorker, /singleLongRunningWorkerOptions/, 'merge worker should use long lock settings for slow render jobs')
assert.match(mergeWorker, /readCompletedDemo/, 'merge worker should skip duplicate jobs once a demo is completed')
assert.match(mergeWorker, /assertAudioFilesReady/, 'merge worker should fail before uploading when narration audio is missing')
assert.match(mergeWorker, /createMergeOutputDir/, 'merge worker should isolate render output by job attempt')
assert.match(mergeWorker, /requireAudio:\s*true/, 'promotional merge must require muxed audio')

const workerOptions = read('src/utils/worker-options.ts')
assert.match(workerOptions, /lockDuration:\s*30 \* 60 \* 1000/, 'long-running jobs should keep locks long enough for TTS/rendering')
assert.match(workerOptions, /concurrency:\s*1/, 'long-running TTS/render workers should default to single concurrency')

console.log('worker job state tests passed')
