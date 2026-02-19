import { Queue } from 'bullmq'
import { connection } from '../utils/redis'

export const parseQueue = new Queue('parse-queue', { connection })
export const recordQueue = new Queue('record-queue', { connection })
export const ttsQueue = new Queue('tts-queue', { connection })
export const mergeQueue = new Queue('merge-queue', { connection })
