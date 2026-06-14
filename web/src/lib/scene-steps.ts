import type { Step } from '@/types'

export type SceneStepsPayloadItem = {
  id: string
  position: number
  title: string
  narration: string | null
  tts_voice_id: string | null
}

function reindexSceneSteps(steps: Step[]): Step[] {
  return steps.map((step, index) => ({ ...step, position: index + 1 }))
}

export function moveSceneStep(steps: Step[], stepId: string, direction: -1 | 1): Step[] {
  const currentIndex = steps.findIndex(step => step.id === stepId)
  if (currentIndex < 0) return steps

  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= steps.length) return steps

  const nextSteps = [...steps]
  const current = nextSteps[currentIndex]
  nextSteps[currentIndex] = nextSteps[nextIndex]
  nextSteps[nextIndex] = current
  return reindexSceneSteps(nextSteps)
}

export function removeSceneStep(steps: Step[], stepId: string): Step[] {
  if (steps.length <= 1) return steps
  return reindexSceneSteps(steps.filter(step => step.id !== stepId))
}

export function toSceneStepsPayload(steps: Step[]): SceneStepsPayloadItem[] {
  return reindexSceneSteps(steps).map(step => ({
    id: step.id,
    position: step.position,
    title: step.title,
    narration: step.narration,
    tts_voice_id: step.tts_voice_id ?? null,
  }))
}
