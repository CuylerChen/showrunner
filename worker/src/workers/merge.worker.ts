import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { supabase } from '../utils/supabase'
import { mergeDemo } from '../services/merger'
import { Paths } from '../utils/paths'
import fs from 'fs'

export interface MergeJobData {
  demoId: string
  videoPath: string
  audioPaths: string[]
  stepTimestamps: { stepId: string; start: number; end: number }[]
  totalDuration: number
}

async function process(job: Job<MergeJobData>) {
  const { demoId, videoPath, audioPaths, stepTimestamps } = job.data
  console.log(`[merge] 开始合成 demo=${demoId}`)

  // 1. 更新状态为 processing
  await supabase
    .from('demos')
    .update({ status: 'processing' })
    .eq('id', demoId)

  await supabase
    .from('jobs')
    .insert({ demo_id: demoId, type: 'merge', status: 'running', started_at: new Date().toISOString() })

  // 2. 合并视频 + 音频
  const { outputPath, duration } = await mergeDemo(
    videoPath,
    audioPaths,
    Paths.finalDir(demoId)
  )

  // 3. 上传到 Supabase Storage
  const fileBuffer = fs.readFileSync(outputPath)
  const storagePath = `${demoId}/final.mp4`

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

  if (uploadError) throw new Error(`上传视频失败: ${uploadError.message}`)

  // 4. 获取公开访问 URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(storagePath)

  const videoUrl = urlData.publicUrl

  // 5. 更新步骤时间戳（用于分享页导航）
  for (const ts of stepTimestamps) {
    await supabase
      .from('steps')
      .update({ timestamp_start: ts.start, timestamp_end: ts.end })
      .eq('id', ts.stepId)
  }

  // 6. 更新 demo 为 completed
  await supabase
    .from('demos')
    .update({
      status: 'completed',
      video_url: videoUrl,
      duration,
      error_message: null,
    })
    .eq('id', demoId)

  await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'merge')

  // 7. 清理本地临时文件
  Paths.cleanup(demoId)

  console.log(`[merge] 完成 demo=${demoId} | 时长=${duration}s | URL=${videoUrl}`)
}

async function onFailed(job: Job<MergeJobData> | undefined, err: Error) {
  if (!job) return
  const { demoId } = job.data
  console.error(`[merge] 失败 demo=${demoId}:`, err.message)

  await supabase
    .from('demos')
    .update({ status: 'failed', error_message: `视频合成失败: ${err.message}` })
    .eq('id', demoId)

  await supabase
    .from('jobs')
    .update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'merge')

  // 失败也清理临时文件，避免磁盘占用
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
