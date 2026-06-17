import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, steps, jobs } from '../utils/db'
import { and, eq } from 'drizzle-orm'
import { parseProductStory, productStorySceneMetadata, type ParseStepsOptions } from '../services/parser'
import { normalizeNarrationLanguageId, type NarrationLanguageId } from '../services/narration-languages'
import { normalizeVideoStyleId, type VideoStyleId } from '../services/video-styles'

export interface ParseJobData {
  demoId: string
  productUrl: string
  description: string | null
  audience?: string
  keyPoints?: string
  brandTone?: string
  ctaText?: string
  ctaUrl?: string
  videoStyle?: VideoStyleId
  narrationLanguage?: NarrationLanguageId
  isReparse?: boolean   // true 时：用登录态重新解析（删除旧步骤，用 session_cookies 加载页面）
}

async function processJob(job: Job<ParseJobData>) {
  const { demoId, productUrl, description, isReparse } = job.data
  const options: ParseStepsOptions = {
    audience: job.data.audience,
    keyPoints: job.data.keyPoints,
    brandTone: job.data.brandTone,
    ctaText: job.data.ctaText,
    ctaUrl: job.data.ctaUrl,
    videoStyle: normalizeVideoStyleId(job.data.videoStyle),
    narrationLanguage: normalizeNarrationLanguageId(job.data.narrationLanguage),
  }
  console.log(`[parse] 开始解析 demo=${demoId}${isReparse ? '（重新解析）' : ''}`)

  // 1. 更新状态为 parsing
  await db.update(demos).set({ status: 'parsing' }).where(eq(demos.id, demoId))

  // 2. 记录 job 开始
  const jobId = crypto.randomUUID()
  await db.insert(jobs).values({
    id:         jobId,
    demo_id:    demoId,
    type:       'parse',
    status:     'running',
    started_at: new Date(),
  })

  // 3. 重新解析时：读取 session_cookies + 删除旧步骤
  let sessionStateJson: string | null = null
  if (isReparse) {
    const demoRow = await db
      .select({ session_cookies: demos.session_cookies })
      .from(demos)
      .where(eq(demos.id, demoId))
      .then(rows => rows[0] ?? null)
    sessionStateJson = demoRow?.session_cookies ?? null

    console.log(`[parse] 重新解析，session=${sessionStateJson ? '有' : '无'}，删除旧步骤...`)
    await db.delete(steps).where(eq(steps.demo_id, demoId))
  }

  // 4. 调用 AI 分析公开资料，生成推广视频场景。
  // 新版推广视频链路不再使用 Playwright 登录态解析；sessionStateJson 仅保留给旧数据兼容。
  void sessionStateJson
  const result = await parseProductStory(demoId, productUrl, description, options)
  const rawSteps = result.steps

  // 5. 批量写入 steps 表
  const stepsToInsert = rawSteps.map(s => ({
    id:                crypto.randomUUID(),
    demo_id:           demoId,
    position:          s.position,
    title:             s.title,
    action_type:       'wait' as const,
    selector:          null,
    value:             productStorySceneMetadata(s, result.brandProfile),
    narration:         s.narration ?? null,
    visual_type:       s.visual_type,
    visual_asset_url:  s.visual_asset_url ?? null,
    wait_for_selector: null,
    status:            'pending' as const,
  }))

  await db.insert(steps).values(stepsToInsert)

  // 5. 更新 demo 状态为 review
  await db.update(demos).set({
    status: 'review',
    title: result.brandProfile.name,
    source_summary: result.sourceSummary,
    thumbnail_url: result.thumbnailUrl,
  }).where(eq(demos.id, demoId))

  // 6. 标记 job 完成
  await db
    .update(jobs)
    .set({ status: 'completed', completed_at: new Date() })
    .where(eq(jobs.id, jobId))

  console.log(`[parse] 完成 demo=${demoId}，生成 ${rawSteps.length} 个推广视频场景，等待用户确认`)
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
    .where(and(
      eq(jobs.demo_id, demoId),
      eq(jobs.type, 'parse'),
      eq(jobs.status, 'running'),
    ))
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
