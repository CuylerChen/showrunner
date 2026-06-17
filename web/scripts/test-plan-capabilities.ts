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
import {
  canUseVideoStyle,
  getAllowedVideoStyles,
  isVideoStyleId,
  VIDEO_STYLES,
} from '../src/lib/video-styles'

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

assert.equal(getPlanCapabilities('free').manualVideoStyles, false)
assert.equal(getPlanCapabilities('starter').manualVideoStyles, true)
assert.equal(getPlanCapabilities('pro').manualVideoStyles, true)

assert.deepEqual(getAllowedVideoStyles('free').map(style => style.id), ['auto'])
assert.deepEqual(
  getAllowedVideoStyles('starter').map(style => style.id),
  ['auto', 'clean_saas', 'bold_launch', 'warm_editorial'],
)
assert.deepEqual(
  getAllowedVideoStyles('pro').map(style => style.id),
  VIDEO_STYLES.map(style => style.id),
)

assert.equal(isVideoStyleId('auto'), true)
assert.equal(isVideoStyleId('creator_social'), true)
assert.equal(isVideoStyleId('unknown_style'), false)

assert.equal(canUseVideoStyle('free', 'auto'), true)
assert.equal(canUseVideoStyle('free', 'clean_saas'), false)
assert.equal(canUseVideoStyle('starter', 'clean_saas'), true)
assert.equal(canUseVideoStyle('starter', 'technical_dark'), false)
assert.equal(canUseVideoStyle('pro', 'technical_dark'), true)
assert.equal(canUseVideoStyle('pro', 'unknown_style'), false)

assert.equal(getTtsQueuePriority('pro') < getTtsQueuePriority('starter'), true)
assert.equal(getTtsQueuePriority('starter') < getTtsQueuePriority('free'), true)

const dashboardPage = read('src/app/(dashboard)/dashboard/page.tsx')
const createFormSource = read('src/components/demo/create-form.tsx')
const zhLocaleSource = read('src/locales/zh.ts')
const enLocaleSource = read('src/locales/en.ts')
const demosRoute = read('src/app/api/demos/route.ts')
const demoDetailRoute = read('src/app/api/demos/[id]/route.ts')
const stepsRoute = read('src/app/api/demos/[id]/steps/route.ts')
const stepAudioRoute = read('src/app/api/demos/[id]/steps/[stepId]/audio/route.ts')
const startRoute = read('src/app/api/demos/[id]/start/route.ts')
const demoDetailPage = read('src/app/(dashboard)/demo/[id]/page.tsx')

assert.match(dashboardPage, /<CreateForm[\s\S]*plan=\{subscription\.plan\}/, 'dashboard should pass current plan into CreateForm')
assert.match(createFormSource, /interface CreateFormProps[\s\S]*plan: PlanType/, 'CreateForm should receive current plan')
assert.match(createFormSource, /getAllowedTtsVoices\(plan\)/, 'CreateForm should show voices allowed by the current plan')
assert.match(createFormSource, /getAllowedVideoStyles\(plan\)/, 'CreateForm should show video styles allowed by the current plan')
assert.match(createFormSource, /VIDEO_STYLES\.map/, 'CreateForm should render the full style catalog with locked options')
assert.match(createFormSource, /allowedStyleIds\.has\(selectedVideoStyleId\) \? selectedVideoStyleId : VIDEO_STYLE_DEFAULT/, 'CreateForm should clamp selected video style to the current plan')
assert.match(createFormSource, /useEffect\(\(\) => \{[\s\S]*setVideoStyleId\(videoStyleId\)/, 'CreateForm should reset a now-locked video style when plan changes')
assert.match(createFormSource, /const locked = !allowedStyleIds\.has\(style\.id\)/, 'CreateForm should identify styles locked by the current plan')
assert.match(createFormSource, /disabled=\{locked\}/, 'CreateForm should disable locked video style options')
assert.match(createFormSource, /cf\.videoStyleStarterLocked/, 'CreateForm should show Starter lock copy for locked styles')
assert.match(createFormSource, /cf\.videoStyleProLocked/, 'CreateForm should show Pro lock copy for locked styles')
assert.match(createFormSource, /tts_voice_id:\s*ttsVoiceId/, 'CreateForm should send selected tts_voice_id')
assert.match(createFormSource, /tts_speed:\s*ttsSpeed/, 'CreateForm should send selected tts_speed')
assert.match(createFormSource, /video_style:\s*videoStyleId/, 'CreateForm should send selected video_style')
assert.match(createFormSource, /setVideoStyleId\(VIDEO_STYLE_DEFAULT\)/, 'CreateForm should reset video style to auto after create')
assert.match(createFormSource, /cf\.videoStyleLabel/, 'CreateForm should use localized video style labels')
assert.match(zhLocaleSource, /import type \{ VideoStyleId \} from '@\/lib\/video-styles'/, 'Chinese locale should import exact video style ids')
assert.match(enLocaleSource, /import type \{ VideoStyleId \} from '@\/lib\/video-styles'/, 'English locale should import exact video style ids')
assert.match(zhLocaleSource, /satisfies Record<VideoStyleId, \{ label: string; description: string \}>/, 'Chinese video style copy should cover exact video style ids')
assert.match(enLocaleSource, /satisfies Record<VideoStyleId, \{ label: string; description: string \}>/, 'English video style copy should cover exact video style ids')
assert.match(demosRoute, /canUseVideoVoice\(subscription\.plan,\s*tts_voice_id\)/, 'create demo API should validate video voice by plan')
assert.match(demosRoute, /canUseTtsSpeed\(subscription\.plan,\s*tts_speed\)/, 'create demo API should validate TTS speed by plan')
assert.match(demosRoute, /tts_voice_id:\s*tts_voice_id \?\? 'default'/, 'create demo API should persist the selected video voice')
assert.match(demosRoute, /tts_speed:\s*tts_speed/, 'create demo API should persist TTS speed')
assert.match(demosRoute, /normalizeVideoStyleId/, 'create demo API should normalize video_style')
assert.match(demosRoute, /canUseVideoStyle\(subscription\.plan,\s*video_style\)/, 'create demo API should validate video style by plan')
assert.match(demosRoute, /video_style:\s*video_style/, 'create demo API should persist the selected video style')
assert.match(demosRoute, /videoStyle:\s*video_style/, 'create demo API should enqueue the selected video style')
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
