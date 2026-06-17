import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isNarrationLanguageId,
  NARRATION_LANGUAGE_DEFAULT,
  NARRATION_LANGUAGES,
  normalizeNarrationLanguageId,
} from '../src/lib/narration-languages'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

assert.equal(NARRATION_LANGUAGE_DEFAULT, 'auto')
assert.deepEqual(
  NARRATION_LANGUAGES.map(language => language.id),
  ['auto', 'en', 'zh', 'ko', 'ja', 'es', 'fr', 'de', 'pt', 'it'],
)
assert.equal(isNarrationLanguageId('ko'), true)
assert.equal(isNarrationLanguageId('unknown'), false)
assert.equal(normalizeNarrationLanguageId(undefined), 'auto')
assert.equal(normalizeNarrationLanguageId(''), 'auto')
assert.equal(normalizeNarrationLanguageId('zh'), 'zh')
assert.equal(normalizeNarrationLanguageId('unknown'), null)

const schemaSql = read('database/schema.sql')
const migration = read('database/migrations/20260617_narration_language.sql')
const webSchema = read('web/src/lib/db/schema.ts')
const workerSchema = read('worker/src/utils/db.ts')
const webTypes = read('web/src/types/index.ts')
const createFormSource = read('web/src/components/demo/create-form.tsx')
const demosRoute = read('web/src/app/api/demos/route.ts')
const loginSaveRoute = read('web/src/app/api/demos/[id]/login-session/save/route.ts')
const zhLocaleSource = read('web/src/locales/zh.ts')
const enLocaleSource = read('web/src/locales/en.ts')

for (const source of [schemaSql, migration]) {
  assert.match(source, /narration_language\s+VARCHAR\(20\)/i, 'demos should include narration_language')
  assert.match(source, /narration_language\s+VARCHAR\(20\)\s+NOT NULL\s+DEFAULT\s+''?auto''?/i, 'narration_language should default to auto')
}

assert.match(webSchema, /narration_language:\s+varchar\('narration_language'/, 'web demo schema should expose narration_language')
assert.match(workerSchema, /narration_language:\s+varchar\('narration_language'/, 'worker demo schema should expose narration_language')
assert.match(webTypes, /narration_language\?: string \| null/, 'web Demo type should include optional narration_language')

assert.match(createFormSource, /NARRATION_LANGUAGES\.map/, 'CreateForm should render narration language choices')
assert.match(createFormSource, /narration_language:\s*narrationLanguage/, 'CreateForm should send selected narration_language')
assert.match(createFormSource, /setNarrationLanguage\(NARRATION_LANGUAGE_DEFAULT\)/, 'CreateForm should reset narration language after create')
assert.match(createFormSource, /cf\.narrationLanguageLabel/, 'CreateForm should use localized narration language label')

assert.match(demosRoute, /normalizeNarrationLanguageId\(parsed\.data\.narration_language\)/, 'create demo API should normalize narration language')
assert.match(demosRoute, /narration_language,/, 'create demo API should persist narration language')
assert.match(demosRoute, /narrationLanguage:\s*narration_language/, 'create demo API should enqueue narration language')
assert.match(loginSaveRoute, /narration_language:\s*schema\.demos\.narration_language/, 'login reparse should keep narration language')
assert.match(loginSaveRoute, /narrationLanguage:\s*demo\.narration_language/, 'login reparse should enqueue narration language')

assert.match(zhLocaleSource, /satisfies Record<NarrationLanguageId, string>/, 'Chinese locale should cover exact narration language ids')
assert.match(enLocaleSource, /satisfies Record<NarrationLanguageId, string>/, 'English locale should cover exact narration language ids')

console.log('narration language tests passed')
