import type { JobsOptions, Queue } from 'bullmq'

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }

const queues = new Map<string, Queue>()

async function getQueue(name: string): Promise<Queue> {
  const cached = queues.get(name)
  if (cached) return cached

  const { Queue } = await import('bullmq')
  const queue = new Queue(name, { connection })
  queues.set(name, queue)
  return queue
}

function lazyQueue(name: string) {
  return {
    async add(jobName: string, data: unknown, options?: JobsOptions) {
      const queue = await getQueue(name)
      return queue.add(jobName, data, options)
    },
  }
}

// 单例 Queue facade（仅用于入队，不在模块加载时连接 Redis）
export const parseQueue  = lazyQueue('parse-queue')
export const recordQueue = lazyQueue('record-queue')
export const ttsQueue    = lazyQueue('tts-queue')
