import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, users, demos, steps, jobs } from '../utils/db'
import { eq } from 'drizzle-orm'
import { parseSteps } from '../services/parser'

export interface ParseJobData {
  demoId: string
  productUrl: string
  description: string | null
  isReparse?: boolean   // true 时：用登录态重新解析（删除旧步骤，用 session_cookies 加载页面）
}

async function processJob(job: Job<ParseJobData>) {
  const { demoId, productUrl, description, isReparse } = job.data
  console.log(`[parse] 开始解析 demo=${demoId}${isReparse ? '（重新解析）' : ''}`)

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

  // 3. 重新解析时：读取 session_cookies + user email + 删除旧步骤
  let sessionStateJson: string | null = null
  let userEmail: string | null = null
  if (isReparse) {
    const demoRow = await db
      .select({ session_cookies: demos.session_cookies, user_id: demos.user_id })
      .from(demos)
      .where(eq(demos.id, demoId))
      .then(rows => rows[0] ?? null)
    sessionStateJson = demoRow?.session_cookies ?? null

    // 读取用户邮箱（用于登录模拟步骤中填写 email 字段）
    if (demoRow?.user_id) {
      userEmail = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, demoRow.user_id))
        .then(rows => rows[0]?.email ?? null)
    }

    console.log(`[parse] 重新解析，session=${sessionStateJson ? '有' : '无'}，email=${userEmail ?? '无'}，删除旧步骤...`)
    await db.delete(steps).where(eq(steps.demo_id, demoId))
  }

  // 4. 调用 AI 解析步骤（isReparse 时传入登录态 + 用户邮箱）
  const rawSteps = await parseSteps(productUrl, description, sessionStateJson, userEmail)

  // 5. 批量写入 steps 表
  const stepsToInsert = rawSteps.map(s => ({
    id:                crypto.randomUUID(),
    demo_id:           demoId,
    position:          s.position,
    title:             s.title,
    action_type:       s.action_type as 'navigate' | 'click' | 'fill' | 'wait' | 'assert',
    selector:          s.selector ?? null,
    value:             s.value ?? null,
    narration:         s.narration ?? null,
    wait_for_selector: (s as { wait_for_selector?: string | null }).wait_for_selector ?? null,
    status:            'pending' as const,
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
  const worker = new Worker<ParseJobData>('parse-queue', processJob, {
    connection,
    concurrency: 3,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[parse] job=${job.id} 完成`))
  console.log('[parse] Worker 已启动')
  return worker
}
