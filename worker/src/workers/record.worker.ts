import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { supabase } from '../utils/supabase'
import { recordDemo } from '../services/recorder'
import { ttsQueue } from '../queues'
import { Paths } from '../utils/paths'
import { Step } from '../types'

export interface RecordJobData {
  demoId: string
  steps: Step[]
}

async function process(job: Job<RecordJobData>) {
  const { demoId, steps } = job.data
  console.log(`[record] 开始录制 demo=${demoId}，共 ${steps.length} 步`)

  // 1. 更新状态为 recording
  await supabase
    .from('demos')
    .update({ status: 'recording' })
    .eq('id', demoId)

  await supabase
    .from('jobs')
    .insert({ demo_id: demoId, type: 'record', status: 'running', started_at: new Date().toISOString() })

  Paths.ensureAll(demoId)

  // 2. 逐步录制，每步失败时更新状态并抛出（触发 paused）
  let videoPath: string
  let stepTimestamps: { stepId: string; start: number; end: number }[]

  try {
    const result = await recordDemo(steps, Paths.videoDir(demoId))
    videoPath = result.videoPath
    stepTimestamps = result.stepTimestamps
  } catch (err) {
    // 找到失败的步骤（通过错误信息中的 position）
    const failedStep = steps.find(s => (err as Error).message.includes(`Step ${s.position}`))

    if (failedStep) {
      await supabase
        .from('steps')
        .update({ status: 'failed' })
        .eq('id', failedStep.id)
    }

    // demo 状态改为 paused，等用户介入
    await supabase
      .from('demos')
      .update({
        status: 'paused',
        error_message: (err as Error).message,
      })
      .eq('id', demoId)

    await supabase
      .from('jobs')
      .update({ status: 'failed', error_message: (err as Error).message, completed_at: new Date().toISOString() })
      .eq('demo_id', demoId)
      .eq('type', 'record')

    throw err  // 让 BullMQ 记录失败，但不再重试（paused 由用户处理）
  }

  // 3. 更新每步时间戳到数据库
  for (const ts of stepTimestamps) {
    await supabase
      .from('steps')
      .update({
        status: 'completed',
        timestamp_start: ts.start,
        timestamp_end: ts.end,
      })
      .eq('id', ts.stepId)
  }

  // 4. 标记 job 完成，入队 tts-queue
  await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'record')

  await ttsQueue.add('tts', {
    demoId,
    steps,
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
  // 状态已在 process 内部更新为 paused，此处无需重复操作
}

export function startRecordWorker() {
  const worker = new Worker<RecordJobData>('record-queue', process, {
    connection,
    concurrency: 1,  // 录制资源密集，串行处理
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[record] job=${job.id} 完成`))
  console.log('[record] Worker 已启动')
  return worker
}
