import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, steps, jobs } from '../utils/db'
import { eq } from 'drizzle-orm'
import { recordDemo } from '../services/recorder'
import { ttsQueue } from '../queues'
import { Paths } from '../utils/paths'
import { Step } from '../types'

export interface RecordJobData {
  demoId: string
  steps: Step[]
}

async function process(job: Job<RecordJobData>) {
  const { demoId, steps: jobSteps } = job.data
  console.log(`[record] 开始录制 demo=${demoId}，共 ${jobSteps.length} 步`)

  // 1. 更新状态为 recording
  await db.update(demos).set({ status: 'recording' }).where(eq(demos.id, demoId))

  await db.insert(jobs).values({
    id:         crypto.randomUUID(),
    demo_id:    demoId,
    type:       'record',
    status:     'running',
    started_at: new Date(),
  })

  Paths.ensureAll(demoId)

  let videoPath: string
  let stepTimestamps: { stepId: string; start: number; end: number }[]

  try {
    const result = await recordDemo(jobSteps, Paths.videoDir(demoId))
    videoPath = result.videoPath
    stepTimestamps = result.stepTimestamps
  } catch (err) {
    const failedStep = jobSteps.find(s => (err as Error).message.includes(`Step ${s.position}`))

    if (failedStep) {
      await db.update(steps).set({ status: 'failed' }).where(eq(steps.id, failedStep.id))
    }

    await db
      .update(demos)
      .set({ status: 'paused', error_message: (err as Error).message })
      .where(eq(demos.id, demoId))

    await db
      .update(jobs)
      .set({ status: 'failed', error_message: (err as Error).message, completed_at: new Date() })
      .where(eq(jobs.demo_id, demoId))

    throw err
  }

  // 3. 更新每步时间戳到数据库
  for (const ts of stepTimestamps) {
    await db
      .update(steps)
      .set({ status: 'completed', timestamp_start: ts.start, timestamp_end: ts.end })
      .where(eq(steps.id, ts.stepId))
  }

  // 4. 标记 job 完成，入队 tts-queue
  await db
    .update(jobs)
    .set({ status: 'completed', completed_at: new Date() })
    .where(eq(jobs.demo_id, demoId))

  await ttsQueue.add('tts', {
    demoId,
    steps: jobSteps,
    videoPath,
    stepTimestamps,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })

  console.log(`[record] 完成 demo=${demoId}，视频: ${videoPath}`)
}

async function onFailed(job: Job<RecordJobData> | undefined, err: Error) {
  if (!job) return
  console.error(`[record] 失败 demo=${job.data.demoId}:`, err.message)
}

export function startRecordWorker() {
  const worker = new Worker<RecordJobData>('record-queue', process, {
    connection,
    concurrency: 1,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[record] job=${job.id} 完成`))
  console.log('[record] Worker 已启动')
  return worker
}
