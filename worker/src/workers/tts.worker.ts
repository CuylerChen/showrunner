import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, jobs } from '../utils/db'
import { and, eq } from 'drizzle-orm'
import { generateNarration } from '../services/tts'
import { mergeQueue } from '../queues'
import { Paths } from '../utils/paths'
import { Step } from '../types'
import { singleLongRunningWorkerOptions } from '../utils/worker-options'

export interface TtsJobData {
  demoId: string
  steps: Step[]
  videoPath?: string
  stepTimestamps?: { stepId: string; start: number; end: number }[]
  ttsVoiceId?: string | null
  ttsSpeed?: number | null
  renderMode?: 'recording' | 'promotional'
}

async function processJob(job: Job<TtsJobData>) {
  const { demoId, steps, videoPath, renderMode, ttsVoiceId, ttsSpeed } = job.data
  console.log(`[tts] 开始生成旁白 demo=${demoId}`)

  const jobId = crypto.randomUUID()
  await db.insert(jobs).values({
    id:         jobId,
    demo_id:    demoId,
    type:       'tts',
    status:     'running',
    started_at: new Date(),
  })

  const { audioPaths, stepDurations, totalDuration } = await generateNarration(steps, Paths.ttsDir(demoId), {
    ttsVoiceId,
    ttsSpeed,
  })

  // 用 TTS 音频实际时长计算章节时间戳（替换录制时间轴，避免超时等待造成偏差）
  const ttsStepTimestamps: { stepId: string; start: number; end: number }[] = []
  let cumulative = 0
  for (let i = 0; i < steps.length; i++) {
    const start = Math.round(cumulative * 10) / 10   // 保留 1 位小数
    cumulative += stepDurations[i] ?? 3
    const end = Math.round(cumulative * 10) / 10
    ttsStepTimestamps.push({ stepId: steps[i].id, start, end })
  }

  try {
    await mergeQueue.add('merge', {
      demoId,
      videoPath,
      audioPaths,
      stepTimestamps: ttsStepTimestamps,   // 使用 TTS 时间轴时间戳
      recordTimestamps: job.data.stepTimestamps,  // 录屏原始时间戳（用于视频切割）
      totalDuration,
      steps,
      renderMode: renderMode ?? (videoPath ? 'recording' : 'promotional'),
    }, {
      priority: job.opts.priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
  } catch (queueError) {
    const message = `MERGE_QUEUE_FAILED: ${(queueError as Error).message}`
    await db
      .update(demos)
      .set({ status: 'failed', error_message: message })
      .where(eq(demos.id, demoId))

    await db
      .update(jobs)
      .set({ status: 'failed', error_message: message, completed_at: new Date() })
      .where(eq(jobs.id, jobId))

    throw new Error(message)
  }

  await db
    .update(jobs)
    .set({ status: 'completed', completed_at: new Date() })
    .where(eq(jobs.id, jobId))

  console.log(`[tts] 完成 demo=${demoId}，${audioPaths.length} 段旁白`)
}

async function onFailed(job: Job<TtsJobData> | undefined, err: Error) {
  if (!job) return
  const { demoId } = job.data
  console.error(`[tts] 失败 demo=${demoId}:`, err.message)
  const message = err.message.startsWith('MERGE_QUEUE_FAILED:')
    ? err.message
    : `TTS 生成失败: ${err.message}`

  await db
    .update(demos)
    .set({ status: 'failed', error_message: message })
    .where(eq(demos.id, demoId))

  await db
    .update(jobs)
    .set({ status: 'failed', error_message: err.message, completed_at: new Date() })
    .where(and(
      eq(jobs.demo_id, demoId),
      eq(jobs.type, 'tts'),
      eq(jobs.status, 'running'),
    ))
}

export function startTtsWorker() {
  const worker = new Worker<TtsJobData>('tts-queue', processJob, {
    connection,
    ...singleLongRunningWorkerOptions,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[tts] job=${job.id} 完成`))
  console.log('[tts] Worker 已启动')
  return worker
}
