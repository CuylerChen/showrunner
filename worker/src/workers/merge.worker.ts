import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, steps, jobs } from '../utils/db'
import { eq } from 'drizzle-orm'
import { mergeDemo } from '../services/merger'
import { Paths } from '../utils/paths'
import { uploadToR2 } from '../utils/r2'
import fs from 'fs'
import path from 'path'

export interface MergeJobData {
  demoId: string
  videoPath: string
  audioPaths: string[]
  stepTimestamps: { stepId: string; start: number; end: number }[]
  totalDuration: number
}

const VIDEO_DIR = process.env.VIDEO_DIR ?? '/data/videos'

async function processJob(job: Job<MergeJobData>) {
  const { demoId, videoPath, audioPaths, stepTimestamps } = job.data
  console.log(`[merge] 开始合成 demo=${demoId}`)

  // 1. 更新状态为 processing
  await db.update(demos).set({ status: 'processing' }).where(eq(demos.id, demoId))

  await db.insert(jobs).values({
    id:         crypto.randomUUID(),
    demo_id:    demoId,
    type:       'merge',
    status:     'running',
    started_at: new Date(),
  })

  // 读取登录视频路径（如果有）
  const demoRow = await db
    .select({ login_video_path: demos.login_video_path })
    .from(demos)
    .where(eq(demos.id, demoId))
    .then(rows => rows[0] ?? null)
  const loginVideoPath = demoRow?.login_video_path ?? null

  // 2. 合并视频 + 音频（可选：前置登录视频）
  const { outputPath, duration, loginDuration } = await mergeDemo(
    videoPath,
    audioPaths,
    Paths.finalDir(demoId),
    loginVideoPath
  )

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
    .where(eq(jobs.demo_id, demoId))

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

  if (isFinal) {
    // 最终失败：标记状态并清理临时文件
    await db
      .update(demos)
      .set({ status: 'failed', error_message: `视频合成失败: ${err.message}` })
      .where(eq(demos.id, demoId))

    await db
      .update(jobs)
      .set({ status: 'failed', error_message: err.message, completed_at: new Date() })
      .where(eq(jobs.demo_id, demoId))

    Paths.cleanup(demoId)
  }
  // 非最终失败：保留临时文件（音频等），供下次重试使用
}

export function startMergeWorker() {
  const worker = new Worker<MergeJobData>('merge-queue', processJob, {
    connection,
    concurrency: 2,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[merge] job=${job.id} 完成`))
  console.log('[merge] Worker 已启动')
  return worker
}
