import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const schemaSql = read('database/schema.sql')
const migration = read('database/migrations/20260614_tiered_tts_capabilities.sql')
const videoStyleMigration = read('database/migrations/20260617_video_style_selection.sql')
const narrationLanguageMigration = read('database/migrations/20260617_narration_language.sql')
const webSchema = read('web/src/lib/db/schema.ts')
const workerSchema = read('worker/src/utils/db.ts')
const webTypes = read('web/src/types/index.ts')
const workerTypes = read('worker/src/types.ts')

for (const source of [schemaSql, migration]) {
  assert.match(source, /tts_voice_id\s+VARCHAR\(40\)/i, 'demos should include tts_voice_id')
  assert.match(source, /tts_speed\s+INT/i, 'demos should include tts_speed')
  assert.match(source, /steps[\s\S]*tts_voice_id\s+VARCHAR\(40\)/i, 'steps should include tts_voice_id')
  assert.match(source, /steps[\s\S]*custom_audio_path\s+TEXT/i, 'steps should include custom_audio_path')
  assert.match(source, /steps[\s\S]*custom_audio_name\s+VARCHAR\(255\)/i, 'steps should include custom_audio_name')
}

for (const source of [schemaSql, videoStyleMigration]) {
  assert.match(source, /video_style\s+VARCHAR\(40\)/i, 'demos should include video_style')
  assert.match(source, /video_style\s+VARCHAR\(40\)\s+NOT NULL\s+DEFAULT\s+''?auto''?/i, 'video_style should default to auto')
}

for (const source of [schemaSql, narrationLanguageMigration]) {
  assert.match(source, /narration_language\s+VARCHAR\(20\)/i, 'demos should include narration_language')
  assert.match(source, /narration_language\s+VARCHAR\(20\)\s+NOT NULL\s+DEFAULT\s+''?auto''?/i, 'narration_language should default to auto')
}

assert.match(webSchema, /tts_voice_id:\s+varchar\('tts_voice_id'/, 'web demo schema should expose tts_voice_id')
assert.match(webSchema, /tts_speed:\s+int\('tts_speed'\)/, 'web demo schema should expose tts_speed')
assert.match(webSchema, /tts_voice_id:\s+varchar\('tts_voice_id'/, 'web step schema should expose tts_voice_id')
assert.match(webSchema, /custom_audio_path:\s+text\('custom_audio_path'\)/, 'web step schema should expose custom_audio_path')
assert.match(webSchema, /custom_audio_name:\s+varchar\('custom_audio_name'/, 'web step schema should expose custom_audio_name')
assert.match(webSchema, /video_style:\s+varchar\('video_style'/, 'web demo schema should expose video_style')
assert.match(webSchema, /narration_language:\s+varchar\('narration_language'/, 'web demo schema should expose narration_language')

assert.match(workerSchema, /tts_voice_id:\s+varchar\('tts_voice_id'/, 'worker schema should expose tts_voice_id')
assert.match(workerSchema, /tts_speed:\s+int\('tts_speed'\)/, 'worker schema should expose tts_speed')
assert.match(workerSchema, /custom_audio_path:\s+text\('custom_audio_path'\)/, 'worker schema should expose custom_audio_path')
assert.match(workerSchema, /custom_audio_name:\s+varchar\('custom_audio_name'/, 'worker schema should expose custom_audio_name')
assert.match(workerSchema, /video_style:\s+varchar\('video_style'/, 'worker schema should expose video_style')
assert.match(workerSchema, /narration_language:\s+varchar\('narration_language'/, 'worker schema should expose narration_language')

assert.match(webTypes, /tts_voice_id\?: string \| null/, 'web Demo type should include optional tts_voice_id')
assert.match(webTypes, /tts_speed\?: number \| null/, 'web Demo type should include optional tts_speed')
assert.match(webTypes, /tts_voice_id\?: string \| null/, 'web Step type should include optional tts_voice_id')
assert.match(webTypes, /custom_audio_path\?: string \| null/, 'web Step type should include optional custom_audio_path')
assert.match(webTypes, /custom_audio_name\?: string \| null/, 'web Step type should include optional custom_audio_name')
assert.match(webTypes, /narration_language\?: string \| null/, 'web Demo type should include optional narration_language')
assert.match(workerTypes, /tts_voice_id\?: string \| null/, 'worker Step type should include optional tts_voice_id')
assert.match(workerTypes, /custom_audio_path\?: string \| null/, 'worker Step type should include optional custom_audio_path')
assert.match(workerTypes, /custom_audio_name\?: string \| null/, 'worker Step type should include optional custom_audio_name')

console.log('tts schema tests passed')
