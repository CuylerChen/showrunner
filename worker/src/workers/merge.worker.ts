import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, steps, jobs } from '../utils/db'
import { and, eq } from 'drizzle-orm'
import { mergeDemo } from '../services/merger'
import { renderPromotionalVideo } from '../services/hyperframes'
import { Paths } from '../utils/paths'
import { uploadToR2 } from '../utils/r2'
import fs from 'fs'
import path from 'path'
import { Step } from '../types'
import { normalizeProductCategory, type ProductCategory } from '../services/parser/scenes'
import { getVideoStorageDir } from '../utils/video-storage'
import { singleLongRunningWorkerOptions } from '../utils/worker-options'

export interface MergeJobData {
  demoId: string
  videoPath?: string
  audioPaths: string[]
  stepTimestamps: { stepId: string; start: number; end: number }[]
  recordTimestamps?: { stepId: string; start: number; end: number }[]  // 录屏原始时间戳
  totalDuration: number
  steps?: Step[]
  renderMode?: 'recording' | 'promotional'
}

const VIDEO_DIR = getVideoStorageDir()

interface PromotionalDemoMetadata {
  title: string | null
  product_url: string | null
  cta_text: string | null
  cta_url: string | null
  brand_tone: string | null
}

interface BuildPromotionalScenesInput {
  steps: Step[]
  audioPaths: string[]
  stepTimestamps: { stepId: string; start: number; end: number }[]
  demo: PromotionalDemoMetadata
}

interface PromotionalStepMetadata {
  kicker?: string | null
  proofPoints?: string[]
  ctaHeadline?: string | null
  visualStyle?: string | null
  brandColor?: string | null
  productType?: ProductCategory | null
}

async function readCompletedDemo(demoId: string) {
  const row = await db
    .select({
      status: demos.status,
      video_url: demos.video_url,
    })
    .from(demos)
    .where(eq(demos.id, demoId))
    .then(rows => rows[0] ?? null)

  return row?.status === 'completed' && row.video_url ? row : null
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'job'
}

function createMergeOutputDir(demoId: string, job: Job<MergeJobData>): string {
  const jobPart = safePathSegment(String(job.id ?? 'job'))
  const attempt = job.attemptsMade + 1
  return path.join(Paths.finalDir(demoId), `${jobPart}-attempt-${attempt}-${crypto.randomUUID()}`)
}

function assertAudioFilesReady(audioPaths: string[], expectedCount: number, label: string) {
  const requiredCount = Math.max(1, expectedCount)

  if (audioPaths.length < requiredCount) {
    throw new Error(`${label} 旁白音频数量不足: 需要 ${requiredCount} 段，实际 ${audioPaths.length} 段`)
  }

  const requiredAudioPaths = audioPaths.slice(0, requiredCount)
  const empty = requiredAudioPaths.filter(audioPath => !audioPath)
  if (empty.length > 0) {
    throw new Error(`${label} 旁白音频路径为空`)
  }

  const missing = requiredAudioPaths.filter(audioPath => !fs.existsSync(audioPath))
  if (missing.length > 0) {
    throw new Error(`${label} 音频文件缺失: ${missing.join(', ')}`)
  }
}

function inferBrandName(demo: PromotionalDemoMetadata): string {
  const title = demo.title?.trim()
  if (title) return title.slice(0, 80)

  try {
    const hostname = new URL(demo.product_url ?? '').hostname.replace(/^www\./, '')
    if (hostname) return hostname.slice(0, 80)
  } catch {}

  return 'Product'
}

function parsePromotionalStepMetadata(value: string | null | undefined): PromotionalStepMetadata {
  if (!value?.trim()?.startsWith('{')) return {}

  try {
    const parsed = JSON.parse(value) as PromotionalStepMetadata
    return {
      kicker: typeof parsed.kicker === 'string' ? parsed.kicker : null,
      proofPoints: Array.isArray(parsed.proofPoints)
        ? parsed.proofPoints.map(point => String(point)).filter(Boolean).slice(0, 4)
        : [],
      ctaHeadline: typeof parsed.ctaHeadline === 'string' ? parsed.ctaHeadline : null,
      visualStyle: typeof parsed.visualStyle === 'string' ? parsed.visualStyle : null,
      brandColor: typeof parsed.brandColor === 'string' ? parsed.brandColor : null,
      productType: typeof parsed.productType === 'string'
        ? normalizeProductCategory(parsed.productType)
        : null,
    }
  } catch {
    return {}
  }
}

export function buildPromotionalScenes(input: BuildPromotionalScenesInput) {
  const brandName = inferBrandName(input.demo)
  const ctaUrl = input.demo.cta_url ?? input.demo.product_url ?? null

  return input.steps.map((step, index) => {
    const timestamp = input.stepTimestamps[index]
    const rawDuration = timestamp ? timestamp.end - timestamp.start : 4
    const metadata = parsePromotionalStepMetadata(step.value)

    return {
      title: step.title,
      narration: step.narration,
      audioPath: input.audioPaths[index] || undefined,
      duration: Math.max(2, rawDuration || 4),
      brandName,
      visualType: step.visual_type ?? 'template',
      visualAssetPath: step.visual_asset_url ?? null,
      ctaText: input.demo.cta_text ?? null,
      ctaUrl,
      brandTone: input.demo.brand_tone ?? null,
      kicker: metadata.kicker ?? null,
      proofPoints: metadata.proofPoints ?? [],
      ctaHeadline: metadata.ctaHeadline ?? null,
      visualStyle: metadata.visualStyle ?? null,
      brandColor: metadata.brandColor ?? null,
      productType: metadata.productType ?? null,
    }
  })
}

async function processJob(job: Job<MergeJobData>) {
  const { demoId, videoPath, audioPaths, stepTimestamps, recordTimestamps, steps: demoSteps, renderMode } = job.data
  console.log(`[merge] 开始合成 demo=${demoId}`)

  const completedDemo = await readCompletedDemo(demoId)
  if (completedDemo) {
    console.log(`[merge] 跳过重复合成 demo=${demoId}，已有完成视频 ${completedDemo.video_url}`)
    return
  }

  // 1. 更新状态为 processing
  await db.update(demos).set({ status: 'processing' }).where(eq(demos.id, demoId))

  const jobId = crypto.randomUUID()
  await db.insert(jobs).values({
    id:         jobId,
    demo_id:    demoId,
    type:       'merge',
    status:     'running',
    started_at: new Date(),
  })

  let outputPath: string
  let duration: number
  let loginDuration = 0
  const outputDir = createMergeOutputDir(demoId, job)

  if ((renderMode === 'promotional' || !videoPath) && demoSteps?.length) {
    assertAudioFilesReady(audioPaths, demoSteps.length, '推广视频')

    const demoRow = await db
      .select({
        title: demos.title,
        product_url: demos.product_url,
        cta_text: demos.cta_text,
        cta_url: demos.cta_url,
        brand_tone: demos.brand_tone,
      })
      .from(demos)
      .where(eq(demos.id, demoId))
      .then(rows => rows[0] ?? null)

    const rendered = await renderPromotionalVideo(
      buildPromotionalScenes({
        steps: demoSteps,
        audioPaths,
        stepTimestamps,
        demo: demoRow ?? {
          title: null,
          product_url: null,
          cta_text: null,
          cta_url: null,
          brand_tone: null,
        },
      }),
      outputDir,
      { requireAudio: true },
    )
    outputPath = rendered.outputPath
    duration = rendered.duration
  } else {
    if (!videoPath) throw new Error('录屏合成缺少 videoPath')
    assertAudioFilesReady(audioPaths, Math.max(stepTimestamps.length, audioPaths.length), '录屏视频')

    // 读取登录视频路径（如果有）
    const demoRow = await db
      .select({ login_video_path: demos.login_video_path })
      .from(demos)
      .where(eq(demos.id, demoId))
      .then(rows => rows[0] ?? null)
    const loginVideoPath = demoRow?.login_video_path ?? null

    // 合并视频 + 音频（可选：前置登录视频）
    const merged = await mergeDemo(
      videoPath,
      audioPaths,
      outputDir,
      loginVideoPath,
      recordTimestamps,
      demoSteps,
    )
    outputPath = merged.outputPath
    duration = merged.duration
    loginDuration = merged.loginDuration
  }

  const completedBeforePublish = await readCompletedDemo(demoId)
  if (completedBeforePublish) {
    await db
      .update(jobs)
      .set({ status: 'completed', completed_at: new Date() })
      .where(eq(jobs.id, jobId))
    console.log(`[merge] 跳过发布重复结果 demo=${demoId}，已有完成视频 ${completedBeforePublish.video_url}`)
    return
  }

  // 3. 优先上传到 R2；失败或未配置时回退到本地持久化存储
  let videoUrl: string
  let r2Url: string | null = null
  try {
    r2Url = await uploadToR2(outputPath, demoId)
  } catch (r2Err: any) {
    console.warn(`[merge] R2 上传失败，回退本地存储: ${r2Err.message}`)
  }

  if (r2Url) {
    videoUrl = r2Url
  } else {
    const destDir  = path.join(VIDEO_DIR, demoId)
    const destPath = path.join(destDir, 'final.mp4')
    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(outputPath, destPath)
    videoUrl = `/videos/${demoId}/final.mp4`
  }

  // 5. 更新步骤时间戳（若有登录视频前缀，所有时间戳需加上登录视频时长偏移）
  for (const ts of stepTimestamps) {
    await db
      .update(steps)
      .set({
        timestamp_start: Math.round(ts.start + loginDuration),
        timestamp_end:   Math.round(ts.end   + loginDuration),
      })
      .where(eq(steps.id, ts.stepId))
  }

  // 6. 更新 demo 为 completed
  await db
    .update(demos)
    .set({ status: 'completed', video_url: videoUrl, duration, error_message: null })
    .where(eq(demos.id, demoId))

  await db
    .update(jobs)
    .set({ status: 'completed', completed_at: new Date() })
    .where(eq(jobs.id, jobId))

  // 7. 清理本地临时文件
  Paths.cleanup(demoId)

  console.log(`[merge] 完成 demo=${demoId} | 时长=${duration}s | URL=${videoUrl}`)
}

async function onFailed(job: Job<MergeJobData> | undefined, err: Error) {
  if (!job) return
  const { demoId } = job.data
  const totalAttempts = job.opts.attempts ?? 1
  const isFinal = job.attemptsMade >= totalAttempts

  console.error(`[merge] 失败 demo=${demoId} [${job.attemptsMade}/${totalAttempts}]:`, err.message)

  const completedDemo = await readCompletedDemo(demoId)
  if (completedDemo) {
    console.warn(`[merge] 忽略已完成 demo 的失败回调 demo=${demoId}，已有视频 ${completedDemo.video_url}`)
    return
  }

  if (isFinal) {
    // 最终失败：标记状态并清理临时文件
    await db
      .update(demos)
      .set({ status: 'failed', error_message: `视频合成失败: ${err.message}` })
      .where(eq(demos.id, demoId))

    await db
      .update(jobs)
      .set({ status: 'failed', error_message: err.message, completed_at: new Date() })
      .where(and(
        eq(jobs.demo_id, demoId),
        eq(jobs.type, 'merge'),
        eq(jobs.status, 'running'),
      ))

    Paths.cleanup(demoId)
  }
  // 非最终失败：保留临时文件（音频等），供下次重试使用
}

export function startMergeWorker() {
  const worker = new Worker<MergeJobData>('merge-queue', processJob, {
    connection,
    ...singleLongRunningWorkerOptions,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[merge] job=${job.id} 完成`))
  console.log('[merge] Worker 已启动')
  return worker
}
