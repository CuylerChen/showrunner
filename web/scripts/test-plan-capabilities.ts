import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canUseCustomAudio,
  canUsePerSceneVoice,
  canUseTtsSpeed,
  canUseVideoVoice,
  getAllowedTtsVoices,
  getPlanCapabilities,
  getTtsQueuePriority,
  TTS_VOICES,
} from '../src/lib/plans'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

assert.equal(getPlanCapabilities('free').videosPerMonth, 1)
assert.equal(getPlanCapabilities('starter').videosPerMonth, 10)
assert.equal(getPlanCapabilities('pro').videosPerMonth, -1)

assert.equal(getPlanCapabilities('free').voiceSelection, false)
assert.equal(getPlanCapabilities('starter').voiceSelection, true)
assert.equal(getPlanCapabilities('pro').voiceSelection, true)

assert.equal(getPlanCapabilities('free').perSceneVoice, false)
assert.equal(getPlanCapabilities('starter').perSceneVoice, false)
assert.equal(getPlanCapabilities('pro').perSceneVoice, true)

assert.equal(getPlanCapabilities('free').customAudio, false)
assert.equal(getPlanCapabilities('starter').customAudio, false)
assert.equal(getPlanCapabilities('pro').customAudio, true)

assert.equal(getPlanCapabilities('free').ttsSpeedControl, false)
assert.equal(getPlanCapabilities('starter').ttsSpeedControl, true)
assert.equal(getPlanCapabilities('pro').ttsSpeedControl, true)

assert.deepEqual(getAllowedTtsVoices('free').map(voice => voice.id), ['default'])
assert.ok(getAllowedTtsVoices('starter').length >= 3, 'Starter should expose multiple preset voices')
assert.deepEqual(
  getAllowedTtsVoices('pro').map(voice => voice.id),
  TTS_VOICES.map(voice => voice.id),
)

assert.equal(canUseVideoVoice('free', 'default'), true)
assert.equal(canUseVideoVoice('free', 'professional_female'), false)
assert.equal(canUseVideoVoice('starter', 'professional_female'), true)
assert.equal(canUseVideoVoice('starter', 'founder_male'), false)
assert.equal(canUseVideoVoice('pro', 'founder_male'), true)

assert.equal(canUsePerSceneVoice('starter', 'professional_female'), false)
assert.equal(canUsePerSceneVoice('pro', 'professional_female'), true)
assert.equal(canUsePerSceneVoice('pro', 'unknown_voice'), false)

assert.equal(canUseCustomAudio('free'), false)
assert.equal(canUseCustomAudio('starter'), false)
assert.equal(canUseCustomAudio('pro'), true)

assert.equal(canUseTtsSpeed('free', 100), true)
assert.equal(canUseTtsSpeed('free', 110), false)
assert.equal(canUseTtsSpeed('starter', 90), true)
assert.equal(canUseTtsSpeed('pro', 120), true)
assert.equal(canUseTtsSpeed('pro', 200), false)

assert.equal(getTtsQueuePriority('pro') < getTtsQueuePriority('starter'), true)
assert.equal(getTtsQueuePriority('starter') < getTtsQueuePriority('free'), true)

const dashboardPage = read('src/app/(dashboard)/dashboard/page.tsx')
const createFormSource = read('src/components/demo/create-form.tsx')
const demosRoute = read('src/app/api/demos/route.ts')
const demoDetailRoute = read('src/app/api/demos/[id]/route.ts')
const stepsRoute = read('src/app/api/demos/[id]/steps/route.ts')
const stepAudioRoute = read('src/app/api/demos/[id]/steps/[stepId]/audio/route.ts')
const startRoute = read('src/app/api/demos/[id]/start/route.ts')
const demoDetailPage = read('src/app/(dashboard)/demo/[id]/page.tsx')

assert.match(dashboardPage, /<CreateForm[\s\S]*plan=\{subscription\.plan\}/, 'dashboard should pass current plan into CreateForm')
assert.match(createFormSource, /interface CreateFormProps[\s\S]*plan: PlanType/, 'CreateForm should receive current plan')
assert.match(createFormSource, /getAllowedTtsVoices\(plan\)/, 'CreateForm should show voices allowed by the current plan')
assert.match(createFormSource, /tts_voice_id:\s*ttsVoiceId/, 'CreateForm should send selected tts_voice_id')
assert.match(createFormSource, /tts_speed:\s*ttsSpeed/, 'CreateForm should send selected tts_speed')
assert.match(demosRoute, /canUseVideoVoice\(subscription\.plan,\s*tts_voice_id\)/, 'create demo API should validate video voice by plan')
assert.match(demosRoute, /canUseTtsSpeed\(subscription\.plan,\s*tts_speed\)/, 'create demo API should validate TTS speed by plan')
assert.match(demosRoute, /tts_voice_id:\s*tts_voice_id \?\? 'default'/, 'create demo API should persist the selected video voice')
assert.match(demosRoute, /tts_speed:\s*tts_speed/, 'create demo API should persist TTS speed')
assert.match(demoDetailRoute, /subscription_plan:\s*subscription\?\.plan \?\? 'free'/, 'demo detail API should return the current plan')
assert.match(stepsRoute, /tts_voice_id:\s*z\.string\(\)\.max\(40\)\.nullable\(\)\.optional\(\)/, 'steps API should accept per-scene tts_voice_id')
assert.match(stepsRoute, /canUsePerSceneVoice\(subscription\.plan,\s*voiceId\)/, 'steps API should gate per-scene voices by plan')
assert.match(stepsRoute, /tts_voice_id\s*=\s*s\.tts_voice_id \|\| null/, 'steps API should normalize empty per-scene voice ids to null')
assert.match(stepAudioRoute, /canUseCustomAudio\(subscription\.plan\)/, 'step audio API should gate custom audio uploads by plan')
assert.match(stepAudioRoute, /formData\(\)/, 'step audio API should accept multipart uploads')
assert.match(startRoute, /ttsVoiceId:\s*demo\.tts_voice_id \?\? 'default'/, 'start API should enqueue demo-level voice settings')
assert.match(startRoute, /getTtsQueuePriority\(subscription\.plan\)/, 'start API should use plan priority when queueing TTS')
assert.match(demoDetailPage, /TTS_VOICES\.map/, 'demo detail page should render per-scene voice choices')
assert.match(demoDetailPage, /demo\.subscription_plan === 'pro'/, 'demo detail page should only enable per-scene voices for Pro')
assert.match(demoDetailPage, /custom_audio_name/, 'demo detail page should show uploaded custom audio')
assert.match(demoDetailPage, /\/audio/, 'demo detail page should upload custom scene audio')

console.log('plan capability tests passed')
