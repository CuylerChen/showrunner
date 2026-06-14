import assert from 'node:assert/strict'
import {
  moveSceneStep,
  removeSceneStep,
  toSceneStepsPayload,
} from '../src/lib/scene-steps'
import type { Step } from '../src/types'

function step(id: string, position: number): Step {
  return {
    id,
    demo_id: 'demo_1',
    position,
    title: `Scene ${position}`,
    action_type: 'wait',
    selector: null,
    value: null,
    narration: `Narration ${position}`,
    tts_voice_id: null,
    custom_audio_path: null,
    custom_audio_name: null,
    visual_type: 'template',
    visual_asset_url: null,
    wait_for_selector: null,
    timestamp_start: null,
    timestamp_end: null,
    status: 'pending',
    created_at: '2026-06-15T00:00:00.000Z',
    updated_at: '2026-06-15T00:00:00.000Z',
  }
}

const steps = [step('a', 1), step('b', 2), step('c', 3)]

assert.deepEqual(
  moveSceneStep(steps, 'b', -1).map(s => [s.id, s.position]),
  [['b', 1], ['a', 2], ['c', 3]],
)

assert.deepEqual(
  moveSceneStep(steps, 'a', -1).map(s => [s.id, s.position]),
  [['a', 1], ['b', 2], ['c', 3]],
)

assert.deepEqual(
  removeSceneStep(steps, 'b').map(s => [s.id, s.position]),
  [['a', 1], ['c', 2]],
)

assert.deepEqual(
  toSceneStepsPayload(moveSceneStep(steps, 'c', -1)),
  [
    { id: 'a', position: 1, title: 'Scene 1', narration: 'Narration 1', tts_voice_id: null },
    { id: 'c', position: 2, title: 'Scene 3', narration: 'Narration 3', tts_voice_id: null },
    { id: 'b', position: 3, title: 'Scene 2', narration: 'Narration 2', tts_voice_id: null },
  ],
)

console.log('scene steps tests passed')
