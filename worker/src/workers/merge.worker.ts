import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { db, demos, steps, jobs } from '../utils/db'
import { eq } from 'drizzle-orm'
import { mergeDemo } from '../services/merger'
import { Paths } from '../utils/paths'
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

async function process(job: Job<MergeJobData>) {
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

  // 2. 合并视频 + 音频
  const { outputPath, duration } = await mergeDemo(
    videoPath,
    audioPaths,
    Paths.finalDir(demoId)
  )

  // 3. 将视频文件复制到持久化存储目录
  const destDir  = path.join(VIDEO_DIR, demoId)
  const destPath = path.join(destDir, 'final.mp4')
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(outputPath, destPath)

  // 4. video_url 存储为相对路径（Nginx 提供静态文件）
  const videoUrl = `/videos/${demoId}/final.mp4`

  // 5. 更新步骤时间戳
  for (const ts of stepTimestamps) {
    await db
      .update(steps)
      .set({ timestamp_start: ts.start, timestamp_end: ts.end })
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
  console.error(`[merge] 失败 demo=${demoId}:`, err.message)

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

export function startMergeWorker() {
  const worker = new Worker<MergeJobData>('merge-queue', process, {
    connection,
    concurrency: 2,
  })

  worker.on('failed', onFailed)
  worker.on('completed', job => console.log(`[merge] job=${job.id} 完成`))
  console.log('[merge] Worker 已启动')
  return worker
}
