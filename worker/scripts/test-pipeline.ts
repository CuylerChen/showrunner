/**
 * 录制管道端到端测试脚本
 * 运行：npx tsx scripts/test-pipeline.ts
 *
 * 演示目标：录制访问 example.com 的完整流程
 */

import path from 'path'
import fs from 'fs'
import { recordDemo } from '../src/services/recorder'
import { generateNarration } from '../src/services/tts'
import { mergeDemo } from '../src/services/merger'
import { Step } from '../src/types'

const OUTPUT_ROOT = path.join(__dirname, '../output/test')

// 测试用步骤（使用公开可访问的网站）
const TEST_STEPS: Step[] = [
  {
    id: 'step-1',
    position: 1,
    title: '打开网站',
    action_type: 'navigate',
    selector: null,
    value: 'https://example.com',
    narration: 'Welcome to our product demo. Let me show you how to get started.',
  },
  {
    id: 'step-2',
    position: 2,
    title: '等待页面加载',
    action_type: 'wait',
    selector: null,
    value: '1500',
    narration: 'The page loads quickly, giving you instant access to all features.',
  },
  {
    id: 'step-3',
    position: 3,
    title: '确认页面元素存在',
    action_type: 'assert',
    selector: 'h1',
    value: null,
    narration: 'As you can see, the interface is clean and easy to navigate.',
  },
]

async function runPipeline() {
  console.log('='.repeat(50))
  console.log('Showrunner — 录制管道测试')
  console.log('='.repeat(50))

  const videoDir = path.join(OUTPUT_ROOT, 'video')
  const ttsDir = path.join(OUTPUT_ROOT, 'tts')
  const finalDir = path.join(OUTPUT_ROOT, 'final')

  // ── Step 1: 录制 ──────────────────────────────────
  console.log('\n[1/3] 开始录制...')
  const { videoPath, stepTimestamps } = await recordDemo(TEST_STEPS, videoDir)
  console.log('录制完成:', videoPath)
  console.log('步骤时间戳:', stepTimestamps)

  // ── Step 2: TTS 旁白 ──────────────────────────────
  console.log('\n[2/3] 生成旁白...')
  const { audioPaths, totalDuration } = await generateNarration(TEST_STEPS, ttsDir)
  console.log(`旁白完成: ${audioPaths.length} 段, 总时长 ${totalDuration}s`)

  // ── Step 3: 合并 ──────────────────────────────────
  console.log('\n[3/3] 合并视频...')
  const { outputPath, duration } = await mergeDemo(videoPath, audioPaths, finalDir)

  // ── 清理录制原始文件 ───────────────────────────────
  try { fs.unlinkSync(videoPath) } catch {}

  // ── 输出结果 ───────────────────────────────────────
  console.log('\n' + '='.repeat(50))
  console.log('✅ 管道测试完成!')
  console.log(`   输出文件: ${outputPath}`)
  console.log(`   视频时长: ${duration} 秒`)
  console.log(`   文件大小: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`)
  console.log('='.repeat(50))
}

runPipeline().catch((err) => {
  console.error('\n❌ 管道测试失败:', err.message)
  process.exit(1)
})
