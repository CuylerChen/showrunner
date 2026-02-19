import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { MergeResult } from '../../types'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

// 拼接多段音频为单个文件
function concatAudio(audioPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (audioPaths.length === 0) {
      reject(new Error('没有音频文件可合并'))
      return
    }

    // 生成 FFmpeg concat 列表文件
    const listPath = outputPath.replace('.wav', '_list.txt')
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
function mergeVideoWithAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    let duration = 0

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',   // 视频编码
        '-c:a aac',       // 音频编码
        '-shortest',      // 以较短的流为准
        '-movflags +faststart', // 支持流式播放
        '-pix_fmt yuv420p',     // 兼容性最广的像素格式
      ])
      .output(outputPath)
      .on('codecData', (data) => {
        // 解析视频时长
        const parts = data.duration?.split(':') ?? []
        if (parts.length === 3) {
          duration = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
        }
      })
      .on('end', () => resolve(Math.round(duration)))
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

  console.log('[merger] 合并视频与旁白...')
  const duration = await mergeVideoWithAudio(videoPath, concatAudioPath, outputPath)

  // 清理中间文件
  fs.unlinkSync(concatAudioPath)
  audioPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })

  console.log(`[merger] 合成完成: ${outputPath} (${duration}s)`)
  return { outputPath, duration }
}
