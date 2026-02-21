import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { MergeResult } from '../../types'

// 优先使用系统 FFmpeg（apt 安装，功能完整）；找不到时回退到打包版
function resolveFFmpegPath(): string {
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    if (fs.existsSync(p)) return p
  }
  return ffmpegInstaller.path
}
ffmpeg.setFfmpegPath(resolveFFmpegPath())

// 用 ffprobe 获取媒体文件时长（秒）
function getMediaDuration(filePath: string): number {
  const ffmpegBin = resolveFFmpegPath()
  // ffprobe 与 ffmpeg 同目录
  const ffprobeBin = ffmpegBin.replace(/ffmpeg$/, 'ffprobe')
  const probePaths = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe', ffprobeBin]

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
  return 0
}

// 拼接多段音频为单个文件
function concatAudio(audioPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (audioPaths.length === 0) {
      reject(new Error('没有音频文件可合并'))
      return
    }

    // 生成 FFmpeg concat 列表文件
    const listPath = outputPath.replace('.wav', '_list.txt')

    // 校验音频文件是否存在，提前报错避免 FFmpeg 给出模糊信息
    const missing = audioPaths.filter(p => !fs.existsSync(p))
    if (missing.length > 0) {
      reject(new Error(`音频文件缺失: ${missing.join(', ')}`))
      return
    }

    fs.mkdirSync(path.dirname(listPath), { recursive: true })
    const listContent = audioPaths.map(p => `file '${p}'`).join('\n')
    fs.writeFileSync(listPath, listContent)

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .output(outputPath)
      .audioCodec('pcm_s16le')
      .on('end', () => {
        fs.unlinkSync(listPath)
        resolve()
      })
      .on('error', reject)
      .run()
  })
}

// 将 .webm 视频与音频合并为 .mp4
// audioDuration：合并后输出时长（秒）= TTS 音频实际时长，保证所有章节时间戳落在视频内
function mergeVideoWithAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  audioDuration: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const opts = [
      '-c:v libx264',
      '-c:a aac',
      '-movflags +faststart',  // 支持流式播放
      '-pix_fmt yuv420p',      // 兼容性最广的像素格式
    ]

    // 用 -t 精确控制输出时长为 TTS 音频时长，避免 -shortest 误截断或视频尾部无声
    if (audioDuration > 0) {
      opts.push(`-t ${audioDuration}`)
    }

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(opts)
      .output(outputPath)
      .on('end', () => resolve(audioDuration > 0 ? Math.round(audioDuration) : 0))
      .on('error', reject)
      .run()
  })
}

export async function mergeDemo(
  videoPath: string,
  audioPaths: string[],
  outputDir: string
): Promise<MergeResult> {
  fs.mkdirSync(outputDir, { recursive: true })

  const concatAudioPath = path.join(outputDir, 'narration.wav')
  const outputPath = path.join(outputDir, 'final.mp4')

  console.log('[merger] 拼接旁白音频...')
  await concatAudio(audioPaths, concatAudioPath)

  // 测量合并后音频的实际时长，用于精确控制输出视频时长
  const audioDuration = getMediaDuration(concatAudioPath)
  console.log(`[merger] 旁白总时长: ${audioDuration.toFixed(1)}s`)

  console.log('[merger] 合并视频与旁白...')
  const duration = await mergeVideoWithAudio(videoPath, concatAudioPath, outputPath, audioDuration)

  // 清理中间文件
  fs.unlinkSync(concatAudioPath)
  audioPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })

  console.log(`[merger] 合成完成: ${outputPath} (${duration}s)`)
  return { outputPath, duration }
}
