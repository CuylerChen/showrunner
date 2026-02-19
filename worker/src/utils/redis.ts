import { ConnectionOptions } from 'bullmq'

export const connection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}
