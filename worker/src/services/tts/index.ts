import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { Step, TtsResult } from '../../types'

// Kokoro TTS 懒加载，避免启动时就加载大模型
let kokoro: any = null

async function getKokoro() {
  if (!kokoro) {
    try {
      const { KokoroTTS } = await import('kokoro-js')
      kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
        dtype: 'q8',   // 量化模型，内存更小
      })
      console.log('[tts] Kokoro 模型加载完成')
    } catch (err) {
      console.warn('[tts] Kokoro 加载失败，将使用静音 fallback:', (err as Error).message)
      kokoro = null
    }
  }
  return kokoro
}

async function generateWithKokoro(text: string, outputPath: string): Promise<boolean> {
  const instance = await getKokoro()
  if (!instance) return false

  try {
    const audio = await instance.generate(text, { voice: 'af_heart' })
    await audio.save(outputPath)
    return true
  } catch (err) {
    console.warn(`[tts] Kokoro 生成失败: ${(err as Error).message}`)
    return false
  }
}

// Fallback：用 FFmpeg 生成与旁白时长匹配的静音音频
function generateSilence(durationSec: number, outputPath: string): void {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
  execSync(
    `"${ffmpegPath}" -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSec} -q:a 9 -acodec libmp3lame "${outputPath}" -y`,
    { stdio: 'pipe' }
  )
}

// 估算文字朗读时长（约 150 词/分钟）
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(2, Math.ceil((words / 150) * 60))
}

export async function generateNarration(
  steps: Step[],
  outputDir: string
): Promise<TtsResult> {
  fs.mkdirSync(outputDir, { recursive: true })

  const audioPaths: string[] = []
  let totalDuration = 0

  for (const step of steps) {
    const narration = step.narration?.trim() || step.title
    const outputPath = path.join(outputDir, `step_${step.position}.wav`)
    const duration = estimateDuration(narration)

    console.log(`[tts] Step ${step.position}: "${narration}"`)

    const success = await generateWithKokoro(narration, outputPath)

    if (!success) {
      // Kokoro 不可用时生成静音占位
      const mp3Path = outputPath.replace('.wav', '.mp3')
      generateSilence(duration, mp3Path)
      audioPaths.push(mp3Path)
    } else {
      audioPaths.push(outputPath)
    }

    totalDuration += duration
  }

  console.log(`[tts] 旁白生成完成，共 ${steps.length} 段，总时长约 ${totalDuration}s`)
  return { audioPaths, totalDuration }
}
