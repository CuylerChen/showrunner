import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, jobs } from '../utils/db'
import { eq } from 'drizzle-orm'
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

async function processJob(job: Job<TtsJobData>) {
  const { demoId, steps, videoPath } = job.data
  console.log(`[tts] 开始生成旁白 demo=${demoId}`)

  await db.insert(jobs).values({
    id:         crypto.randomUUID(),
    demo_id:    demoId,
    type:       'tts',
    status:     'running',
    started_at: new Date(),
  })

  const { audioPaths, stepDurations, totalDuration } = await generateNarration(steps, Paths.ttsDir(demoId))

  // 用 TTS 音频实际时长计算章节时间戳（替换录制时间轴，避免超时等待造成偏差）
  const ttsStepTimestamps: { stepId: string; start: number; end: number }[] = []
  let cumulative = 0
  for (let i = 0; i < steps.length; i++) {
    const start = Math.round(cumulative * 10) / 10   // 保留 1 位小数
    cumulative += stepDurations[i] ?? 3
    const end = Math.round(cumulative * 10) / 10
    ttsStepTimestamps.push({ stepId: steps[i].id, start, end })
  }

  await db
    .update(jobs)
    .set({ status: 'completed', completed_at: new Date() })
    .where(eq(jobs.demo_id, demoId))

  await mergeQueue.add('merge', {
    demoId,
    videoPath,
    audioPaths,
    stepTimestamps: ttsStepTimestamps,   // 使用 TTS 时间轴时间戳
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

  await db
    .update(demos)
    .set({ status: 'failed', error_message: `TTS 生成失败: ${err.message}` })
    .where(eq(demos.id, demoId))

  await db
    .update(jobs)
    .set({ status: 'failed', error_message: err.message, completed_at: new Date() })
    .where(eq(jobs.demo_id, demoId))
}

export function startTtsWorker() {
  const worker = new Worker<TtsJobData>('tts-queue', processJob, {
    connection,
    concurrency: 2,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[tts] job=${job.id} 完成`))
  console.log('[tts] Worker 已启动')
  return worker
}
