import 'dotenv/config'
import { startParseWorker }  from './workers/parse.worker'
import { startRecordWorker } from './workers/record.worker'
import { startTtsWorker }    from './workers/tts.worker'
import { startMergeWorker }  from './workers/merge.worker'
import { startHttpServer }   from './http-server'

function resolveWorkerPort() {
  const rawPort = process.env.WORKER_PORT
  if (!rawPort) return 3001

  const parsed = Number.parseInt(rawPort, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid WORKER_PORT: ${rawPort}`)
  }

  return parsed
}

function resolveWorkerHost() {
  return process.env.WORKER_HOST?.trim() || '127.0.0.1'
}

async function main() {
  console.log('='.repeat(50))
  console.log('Showrunner Worker 启动中...')
  console.log('='.repeat(50))

  const workers = [
    startParseWorker(),
    startRecordWorker(),
    startTtsWorker(),
    startMergeWorker(),
  ]

  const httpServer = startHttpServer(resolveWorkerPort(), resolveWorkerHost())

  console.log('\n✅ 所有 Worker 已就绪，等待任务...\n')

  // 优雅退出：关闭所有 Worker 后再退出
  const shutdown = async (signal: string) => {
    console.log(`\n收到 ${signal}，正在关闭 Worker...`)
    await Promise.all(workers.map(w => w.close()))
    httpServer.close()
    console.log('Worker 已安全关闭')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

main().catch(err => {
  console.error('Worker 启动失败:', err)
  process.exit(1)
})
