import { Worker, Job } from 'bullmq'
import { connection } from '../utils/redis'
import { supabase } from '../utils/supabase'
import { parseSteps } from '../services/parser'
import { recordQueue } from '../queues'

export interface ParseJobData {
  demoId: string
  productUrl: string
  description: string | null
}

async function process(job: Job<ParseJobData>) {
  const { demoId, productUrl, description } = job.data
  console.log(`[parse] 开始解析 demo=${demoId}`)

  // 1. 更新状态为 parsing
  await supabase
    .from('demos')
    .update({ status: 'parsing' })
    .eq('id', demoId)

  // 2. 记录 job 开始
  await supabase
    .from('jobs')
    .insert({ demo_id: demoId, type: 'parse', status: 'running', started_at: new Date().toISOString() })

  // 3. 调用 OpenRouter 解析步骤
  const rawSteps = await parseSteps(productUrl, description)

  // 4. 批量写入 steps 表
  const stepsToInsert = rawSteps.map(s => ({
    demo_id:     demoId,
    position:    s.position,
    title:       s.title,
    action_type: s.action_type,
    selector:    s.selector,
    value:       s.value,
    narration:   s.narration,
    status:      'pending' as const,
  }))

  const { error: insertError } = await supabase.from('steps').insert(stepsToInsert)
  if (insertError) throw new Error(`写入步骤失败: ${insertError.message}`)

  // 5. 更新 demo 状态为 review（等待用户确认）
  await supabase
    .from('demos')
    .update({ status: 'review' })
    .eq('id', demoId)

  // 6. 标记 job 完成
  await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'parse')

  console.log(`[parse] 完成 demo=${demoId}，生成 ${rawSteps.length} 个步骤，等待用户确认`)
}

async function onFailed(job: Job<ParseJobData> | undefined, err: Error) {
  if (!job) return
  const { demoId } = job.data
  console.error(`[parse] 失败 demo=${demoId}:`, err.message)

  await supabase
    .from('demos')
    .update({ status: 'failed', error_message: err.message })
    .eq('id', demoId)

  await supabase
    .from('jobs')
    .update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('type', 'parse')
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
