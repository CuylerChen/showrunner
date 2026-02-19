import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, steps, jobs } from '../utils/db'
import { eq } from 'drizzle-orm'
import { parseSteps } from '../services/parser'

export interface ParseJobData {
  demoId: string
  productUrl: string
  description: string | null
}

async function process(job: Job<ParseJobData>) {
  const { demoId, productUrl, description } = job.data
  console.log(`[parse] 开始解析 demo=${demoId}`)

  // 1. 更新状态为 parsing
  await db.update(demos).set({ status: 'parsing' }).where(eq(demos.id, demoId))

  // 2. 记录 job 开始
  await db.insert(jobs).values({
    id:         crypto.randomUUID(),
    demo_id:    demoId,
    type:       'parse',
    status:     'running',
    started_at: new Date(),
  })

  // 3. 调用 OpenRouter 解析步骤
  const rawSteps = await parseSteps(productUrl, description)

  // 4. 批量写入 steps 表
  const stepsToInsert = rawSteps.map(s => ({
    id:          crypto.randomUUID(),
    demo_id:     demoId,
    position:    s.position,
    title:       s.title,
    action_type: s.action_type as 'navigate' | 'click' | 'fill' | 'wait' | 'assert',
    selector:    s.selector ?? null,
    value:       s.value ?? null,
    narration:   s.narration ?? null,
    status:      'pending' as const,
  }))

  await db.insert(steps).values(stepsToInsert)

  // 5. 更新 demo 状态为 review
  await db.update(demos).set({ status: 'review' }).where(eq(demos.id, demoId))

  // 6. 标记 job 完成
  await db
    .update(jobs)
    .set({ status: 'completed', completed_at: new Date() })
    .where(eq(jobs.demo_id, demoId))

  console.log(`[parse] 完成 demo=${demoId}，生成 ${rawSteps.length} 个步骤，等待用户确认`)
}

async function onFailed(job: Job<ParseJobData> | undefined, err: Error) {
  if (!job) return
  const { demoId } = job.data
  console.error(`[parse] 失败 demo=${demoId}:`, err.message)

  await db
    .update(demos)
    .set({ status: 'failed', error_message: err.message })
    .where(eq(demos.id, demoId))

  await db
    .update(jobs)
    .set({ status: 'failed', error_message: err.message, completed_at: new Date() })
    .where(eq(jobs.demo_id, demoId))
}

export function startParseWorker() {
  const worker = new Worker<ParseJobData>('parse-queue', process, {
    connection,
    concurrency: 3,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[parse] job=${job.id} 完成`))
  console.log('[parse] Worker 已启动')
  return worker
}
