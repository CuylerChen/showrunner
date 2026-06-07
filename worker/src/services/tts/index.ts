import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { Step, TtsResult } from '../../types'

type OpenAITtsConfig = {
  apiKey: string
  baseUrl: string
  model: string
  voice: string
  speed: number
  instructions?: string
}

export type TtsConfig =
  | { provider: 'openai', openai: OpenAITtsConfig }
  | { provider: 'kokoro', openai?: undefined }

function cleanEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseTtsSpeed(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0.95
  return Math.min(4, Math.max(0.25, parsed))
}

export function resolveTtsConfig(env: NodeJS.ProcessEnv = process.env): TtsConfig {
  const requestedProvider = cleanEnvValue(env.TTS_PROVIDER)?.toLowerCase() ?? 'auto'

  if (requestedProvider === 'kokoro') {
    return { provider: 'kokoro' }
  }

  const apiKey = cleanEnvValue(env.OPENAI_TTS_API_KEY)
  if (!apiKey) {
    return { provider: 'kokoro' }
  }

  return {
    provider: 'openai',
    openai: {
      apiKey,
      baseUrl: (cleanEnvValue(env.OPENAI_TTS_BASE_URL) ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: cleanEnvValue(env.OPENAI_TTS_MODEL) ?? 'gpt-4o-mini-tts',
      voice: cleanEnvValue(env.OPENAI_TTS_VOICE) ?? 'coral',
      speed: parseTtsSpeed(env.OPENAI_TTS_SPEED),
      instructions: cleanEnvValue(env.OPENAI_TTS_INSTRUCTIONS),
    },
  }
}

// 使用系统 ffprobe 测量音频文件的实际时长（秒）
function getAudioDuration(filePath: string): number {
  const probePaths = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe']
  for (const probePath of probePaths) {
    if (!fs.existsSync(probePath)) continue
    try {
      const out = execSync(
        `"${probePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { stdio: ['pipe', 'pipe', 'pipe'] }
      )
      const dur = parseFloat(out.toString().trim())
      if (!isNaN(dur) && dur > 0) return dur
    } catch {}
  }
  // fallback：用 @ffmpeg-installer 附带的 ffprobe（与 ffmpeg 同目录）
  try {
    const ffmpegPath: string = require('@ffmpeg-installer/ffmpeg').path
    const ffprobePath = ffmpegPath.replace(/ffmpeg$/, 'ffprobe')
    if (fs.existsSync(ffprobePath)) {
      const out = execSync(
        `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { stdio: ['pipe', 'pipe', 'pipe'] }
      )
      const dur = parseFloat(out.toString().trim())
      if (!isNaN(dur) && dur > 0) return dur
    }
  } catch {}
  // 最终兜底：使用估算值
  return 3
}

// ── OpenAI TTS-compatible speech endpoint（可选高质量旁白）────────
async function generateWithOpenAI(text: string, outputPath: string, config: OpenAITtsConfig): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      model: config.model,
      input: text,
      voice: config.voice,
      response_format: 'mp3',
      speed: config.speed,
    }
    if (config.instructions) body.instructions = config.instructions

    const response = await fetch(`${config.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.warn(`[tts] OpenAI TTS 失败 (${response.status}): ${errText.slice(0, 100)}`)
      return false
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(outputPath, buffer)
    console.log(`[tts] OpenAI TTS 成功: ${outputPath}`)
    return true
  } catch (err) {
    console.warn(`[tts] OpenAI TTS 异常: ${(err as Error).message}`)
    return false
  }
}

// ── Kokoro TTS 懒加载（fallback 方案）───────────────────────────
let kokoro: any = null

async function getKokoro() {
  if (!kokoro) {
    try {
      const { KokoroTTS } = await import('kokoro-js')
      kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
        dtype: 'q8',
      })
      console.log('[tts] Kokoro 模型加载完成')
    } catch (err) {
      console.warn('[tts] Kokoro 加载失败:', (err as Error).message)
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

// Fallback：用 FFmpeg 生成静音音频
function generateSilence(durationSec: number, outputPath: string): void {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
  execSync(
    `"${ffmpegPath}" -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSec} -q:a 9 -acodec libmp3lame "${outputPath}" -y`,
    { stdio: 'pipe' }
  )
}

// 估算文字朗读时长（约 150 词/分钟）
function estimateDuration(text: string): number {
  // 中文按字数估算（约 4 字/秒），英文按词数（约 2.5 词/秒）
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').trim().split(/\s+/).filter(Boolean).length
  const seconds = chineseChars / 4 + englishWords / 2.5
  return Math.max(2, Math.ceil(seconds))
}

export async function generateNarration(
  steps: Step[],
  outputDir: string
): Promise<TtsResult> {
  fs.mkdirSync(outputDir, { recursive: true })
  const ttsConfig = resolveTtsConfig()

  const audioPaths: string[] = []
  const stepDurations: number[] = []
  let totalDuration = 0

  for (const step of steps) {
    const narration = step.narration?.trim() || step.title
    const outputPathMp3 = path.join(outputDir, `step_${step.position}.mp3`)
    const outputPathWav = path.join(outputDir, `step_${step.position}.wav`)
    const estimatedDuration = estimateDuration(narration)

    console.log(`[tts] Step ${step.position}: "${narration}"`)

    let finalPath: string
    let success = false

    if (ttsConfig.provider === 'openai') {
      success = await generateWithOpenAI(narration, outputPathMp3, ttsConfig.openai)
    }

    if (success) {
      finalPath = outputPathMp3
    } else {
      // 使用 Kokoro TTS（免费本地方案），fallback 到静音
      success = await generateWithKokoro(narration, outputPathWav)
      if (success) {
        finalPath = outputPathWav
      } else {
        // Kokoro 失败，生成静音占位
        generateSilence(estimatedDuration, outputPathMp3)
        finalPath = outputPathMp3
      }
    }

    audioPaths.push(finalPath)

    // 优先使用 ffprobe 测量实际音频时长，保证时间戳精准
    const actualDuration = getAudioDuration(finalPath)
    stepDurations.push(actualDuration)
    totalDuration += actualDuration
  }

  console.log(`[tts] 旁白生成完成，共 ${steps.length} 段，总时长约 ${totalDuration.toFixed(1)}s`)
  return { audioPaths, stepDurations, totalDuration }
}
