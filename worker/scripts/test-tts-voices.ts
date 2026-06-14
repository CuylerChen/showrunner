import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveOpenAiVoice,
  resolveKokoroVoice,
  resolveStepTtsVoiceId,
  speechSpeedFromPercent,
} from '../src/services/tts/voices'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ttsSource = fs.readFileSync(path.join(root, 'src/services/tts/index.ts'), 'utf8')

assert.equal(resolveStepTtsVoiceId(null, null), 'default')
assert.equal(resolveStepTtsVoiceId(undefined, 'warm_male'), 'warm_male')
assert.equal(resolveStepTtsVoiceId('professional_female', 'warm_male'), 'professional_female')
assert.equal(resolveStepTtsVoiceId('unknown', 'warm_male'), 'warm_male')

assert.equal(resolveOpenAiVoice('default', 'coral'), 'coral')
assert.equal(resolveOpenAiVoice('professional_female', 'coral'), 'nova')
assert.equal(resolveOpenAiVoice('warm_male', 'coral'), 'onyx')
assert.equal(resolveOpenAiVoice('energetic_female', 'coral'), 'shimmer')
assert.equal(resolveOpenAiVoice('founder_male', 'coral'), 'echo')

assert.equal(resolveKokoroVoice('default'), 'af_heart')
assert.equal(resolveKokoroVoice('professional_female'), 'af_sky')
assert.equal(resolveKokoroVoice('warm_male'), 'am_adam')
assert.equal(resolveKokoroVoice('energetic_female'), 'af_bella')
assert.equal(resolveKokoroVoice('founder_male'), 'am_michael')

assert.equal(speechSpeedFromPercent(undefined, 0.95), 0.95)
assert.equal(speechSpeedFromPercent(100, 0.95), 1)
assert.equal(speechSpeedFromPercent(25, 0.95), 0.25)
assert.equal(speechSpeedFromPercent(500, 0.95), 4)

assert.match(ttsSource, /custom_audio_path/, 'TTS should inspect per-step custom audio path')
assert.match(ttsSource, /copyCustomAudio/, 'TTS should copy custom audio into the temporary TTS output directory')
assert.match(ttsSource, /continue/, 'TTS should skip generated speech when custom audio exists')

console.log('tts voice tests passed')
