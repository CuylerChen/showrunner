import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { supabase } from '../utils/supabase'
import { generateNarration } from '../services/tts'
import { mergeQueue } from '../queues'
import { Paths } from '../utils/paths'
import { Step } from '../types'

export interface TtsJobData {
  demoId: string
  steps: Step[]
  videoPath: string
  stepTimestamps: { stepId: string; start: number; end: number }[]
}

async function process(job: Job<TtsJobData>) {
  const { demoId, steps, videoPath, stepTimestamps } = job.data
  console.log(`[tts] 开始生成旁白 demo=${demoId}`)

  await supabase
    .from('jobs')
    .insert({ demo_id: demoId, type: 'tts', status: 'running', started_at: new Date().toISOString() })

  // 生成旁白音频
  const { audioPaths, totalDuration } = await generateNarration(steps, Paths.ttsDir(demoId))

  // 标记完成，入队 merge-queue
  await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'tts')

  await mergeQueue.add('merge', {
    demoId,
    videoPath,
    audioPaths,
    stepTimestamps,
    totalDuration,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })

  console.log(`[tts] 完成 demo=${demoId}，${audioPaths.length} 段旁白`)
}

async function onFailed(job: Job<TtsJobData> | undefined, err: Error) {
  if (!job) return
  const { demoId } = job.data
  console.error(`[tts] 失败 demo=${demoId}:`, err.message)

  await supabase
    .from('demos')
    .update({ status: 'failed', error_message: `TTS 生成失败: ${err.message}` })
    .eq('id', demoId)

  await supabase
    .from('jobs')
    .update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'tts')
}

export function startTtsWorker() {
  const worker = new Worker<TtsJobData>('tts-queue', process, {
    connection,
    concurrency: 2,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[tts] job=${job.id} 完成`))
  console.log('[tts] Worker 已启动')
  return worker
}
