import { Queue } from 'bullmq'

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }

// 单例 Queue 客户端（仅用于入队，不运行 Worker）
export const parseQueue  = new Queue('parse-queue',  { connection })
export const recordQueue = new Queue('record-queue', { connection })
