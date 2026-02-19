/**
 * 完整管道端到端测试（不依赖 Redis/Supabase，直接串联四个服务）
 * 运行：npm run test:full
 *
 * 模拟流程：parse → record → tts → merge
 */

import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { parseSteps }        from '../src/services/parser'
import { recordDemo }        from '../src/services/recorder'
import { generateNarration } from '../src/services/tts'
import { mergeDemo }         from '../src/services/merger'
import { Step }              from '../src/types'

const DEMO_ID    = 'test-' + Date.now()
const OUTPUT_DIR = path.join(os.tmpdir(), 'showrunner', DEMO_ID)

// 测试目标：可替换为你自己的产品 URL
const PRODUCT_URL  = 'https://example.com'
const DESCRIPTION  = 'Show the main page and explain what it offers'

function log(stage: string, msg: string) {
  console.log(`\n${'─'.repeat(48)}`)
  console.log(`[${stage}] ${msg}`)
  console.log('─'.repeat(48))
}

async function runFullPipeline() {
  console.log('='.repeat(50))
  console.log('Showrunner — 完整四阶段管道测试')
  console.log(`Demo ID: ${DEMO_ID}`)
  console.log('='.repeat(50))

  // ── Phase 1: Parse ────────────────────────────────
  log('1/4 PARSE', `解析步骤: ${PRODUCT_URL}`)

  let steps: Step[]

  const MOCK_STEPS: Step[] = [
    { id: 's1', position: 1, title: '打开网站',     action_type: 'navigate', selector: null, value: PRODUCT_URL, narration: 'Let me show you our product homepage.' },
    { id: 's2', position: 2, title: '等待加载',     action_type: 'wait',     selector: null, value: '1500',      narration: 'The page loads instantly with all key information.' },
    { id: 's3', position: 3, title: '确认标题存在', action_type: 'assert',   selector: 'h1', value: null,        narration: 'As you can see, the interface is clean and intuitive.' },
  ]

  if (!process.env.OPENROUTER_API_KEY) {
    console.log('⚠️  未设置 OPENROUTER_API_KEY，使用 Mock 步骤')
    steps = MOCK_STEPS
  } else {
    try {
      const rawSteps = await parseSteps(PRODUCT_URL, DESCRIPTION)
      steps = rawSteps.map((s, i) => ({ ...s, id: `s${i + 1}` })) as Step[]
      console.log(`✅ AI 解析完成，共 ${steps.length} 个步骤:`)
      steps.forEach(s => console.log(`   ${s.position}. [${s.action_type}] ${s.title}`))
    } catch (err) {
      console.warn(`⚠️  AI 解析失败 (${(err as Error).message.slice(0, 80)})`)
      console.warn('⚠️  使用 Mock 步骤继续测试后续阶段')
      steps = MOCK_STEPS
    }
  }

  // ── Phase 2: Record ───────────────────────────────
  log('2/4 RECORD', `录制 ${steps.length} 个步骤`)

  const videoDir = path.join(OUTPUT_DIR, 'video')
  const { videoPath, stepTimestamps } = await recordDemo(steps, videoDir)

  console.log(`✅ 录制完成: ${path.basename(videoPath)}`)
  stepTimestamps.forEach(ts => {
    const step = steps.find(s => s.id === ts.stepId)
    console.log(`   Step ${step?.position}: ${ts.start.toFixed(2)}s → ${ts.end.toFixed(2)}s`)
  })

  // ── Phase 3: TTS ──────────────────────────────────
  log('3/4 TTS', '生成旁白音频')

  const ttsDir = path.join(OUTPUT_DIR, 'tts')
  const { audioPaths, totalDuration } = await generateNarration(steps, ttsDir)

  console.log(`✅ 旁白完成: ${audioPaths.length} 段，估算总时长 ${totalDuration}s`)

  // ── Phase 4: Merge ────────────────────────────────
  log('4/4 MERGE', '合并视频与旁白')

  const finalDir = path.join(OUTPUT_DIR, 'final')
  const { outputPath, duration } = await mergeDemo(videoPath, audioPaths, finalDir)

  // ── 结果 ──────────────────────────────────────────
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)

  console.log('\n' + '='.repeat(50))
  console.log('✅ 完整管道测试通过！')
  console.log(`   输出文件:  ${outputPath}`)
  console.log(`   视频时长:  ${duration} 秒`)
  console.log(`   文件大小:  ${fileSizeMB} MB`)
  console.log(`   步骤数量:  ${steps.length}`)
  console.log('\n分享页步骤导航数据:')
  stepTimestamps.forEach(ts => {
    const step = steps.find(s => s.id === ts.stepId)
    console.log(`   ${step?.position}. "${step?.title}" → ${ts.start.toFixed(1)}s–${ts.end.toFixed(1)}s`)
  })
  console.log('='.repeat(50))
}

runFullPipeline().catch(err => {
  console.error('\n❌ 管道测试失败:', err.message)
  console.error(err.stack)
  process.exit(1)
})
