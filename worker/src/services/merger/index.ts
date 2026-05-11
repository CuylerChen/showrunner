import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { MergeResult, Step } from '../../types'
import { HyperframesClip, renderHyperframesDemo, stepsToClipMetadata } from '../hyperframes'

// 优先使用系统 FFmpeg（apt 安装，功能完整）；找不到时回退到打包版
function resolveFFmpegPath(): string {
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    if (fs.existsSync(p)) return p
  }
  return ffmpegInstaller.path
}
ffmpeg.setFfmpegPath(resolveFFmpegPath())

function resolveFFprobePath(): string {
  for (const p of ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe']) {
    if (fs.existsSync(p)) return p
  }
  const ffmpegBin = resolveFFmpegPath()
  return ffmpegBin.replace(/ffmpeg$/, 'ffprobe')
}

// 用 ffprobe 获取媒体文件时长（秒）
function getMediaDuration(filePath: string): number {
  const probePath = resolveFFprobePath()
  try {
    const out = execSync(
      `"${probePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const dur = parseFloat(out.toString().trim())
    if (!isNaN(dur) && dur > 0) return dur
  } catch {}
  return 0
}

// ── 切割视频片段 + 变速对齐 TTS 时长 ─────────────────────────────
function cutAndRescale(
  inputPath: string,
  startSec: number,
  videoDuration: number,
  targetDuration: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 计算变速因子：>1 加速（视频太长），<1 减速（视频太短）
    const speedFactor = videoDuration / targetDuration

    // 限制变速范围：0.5x ~ 3x，超出范围则截断/冻结
    const clampedSpeed = Math.max(0.5, Math.min(3.0, speedFactor))
    const ptsFactor = (1 / clampedSpeed).toFixed(4)

    console.log(`[merger] 片段: start=${startSec.toFixed(1)}s dur=${videoDuration.toFixed(1)}s → target=${targetDuration.toFixed(1)}s (speed=${clampedSpeed.toFixed(2)}x)`)

    ffmpeg()
      .input(inputPath)
      .inputOptions([`-ss ${startSec}`, `-t ${videoDuration}`])
      .videoFilter(`setpts=${ptsFactor}*PTS`)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-an',   // 无音频（后续单独合并）
        `-t ${targetDuration}`,
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

// ── 为单个片段合并视频 + 音频 ────────────────────────────────────
function mergeClipWithAudio(
  videoClip: string,
  audioClip: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioDuration = getMediaDuration(audioClip)

    ffmpeg()
      .input(videoClip)
      .input(audioClip)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-b:a 128k',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        `-t ${audioDuration}`,   // 以音频时长为准
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

// 拼接多段音频为单个文件
function concatAudio(audioPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (audioPaths.length === 0) {
      reject(new Error('没有音频文件可合并'))
      return
    }

    const listPath = outputPath.replace(/\.\w+$/, '_list.txt')

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
        try { fs.unlinkSync(listPath) } catch {}
        resolve()
      })
      .on('error', reject)
      .run()
  })
}

// 用 FFmpeg concat demuxer 拼接多段 .mp4 视频
function concatVideos(videoPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listPath = outputPath.replace('.mp4', '_concat_list.txt')
    const listContent = videoPaths.map(p => `file '${p}'`).join('\n')
    fs.writeFileSync(listPath, listContent)

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('end', () => { try { fs.unlinkSync(listPath) } catch {}; resolve() })
      .on('error', (err) => { try { fs.unlinkSync(listPath) } catch {}; reject(err) })
      .run()
  })
}

// 将登录录制视频（.webm）处理为 2x 加速的 .mp4 片段（无音频）
function processLoginVideo(webmPath: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(webmPath)
      .videoFilter('setpts=0.5*PTS')
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-an',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => {
        const dur = getMediaDuration(outputPath)
        console.log(`[merger] 登录视频处理完成 (2x加速): ${dur.toFixed(1)}s`)
        resolve(dur)
      })
      .on('error', reject)
      .run()
  })
}

// 简单合并（无时间对齐，fallback 模式）
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
      '-movflags +faststart',
      '-pix_fmt yuv420p',
    ]
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
  outputDir: string,
  loginVideoWebmPath?: string | null,
  stepTimestamps?: { stepId: string; start: number; end: number }[],
  demoSteps?: Step[],
): Promise<MergeResult & { loginDuration: number }> {
  fs.mkdirSync(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, 'final.mp4')
  const loginMp4Path = path.join(outputDir, 'login.mp4')

  const videoDuration = getMediaDuration(videoPath)

  // ── 尝试按步骤时间对齐 ────────────────────────────────────────
  if (stepTimestamps && stepTimestamps.length === audioPaths.length && stepTimestamps.length > 0) {
    console.log('[merger] 使用 HyperFrames 按步时间对齐合成...')

    const clipPaths: string[] = []
    const clipMetadata = stepsToClipMetadata(demoSteps)

    for (let i = 0; i < stepTimestamps.length; i++) {
      const ts = stepTimestamps[i]
      const stepVideoDuration = ts.end - ts.start
      const stepAudioDuration = getMediaDuration(audioPaths[i])
      const clipVideoPath = path.join(outputDir, `clip_${i}_v.mp4`)

      if (stepVideoDuration <= 0 || stepAudioDuration <= 0) {
        console.warn(`[merger] Step ${i} 时长异常 (video=${stepVideoDuration.toFixed(1)}s audio=${stepAudioDuration.toFixed(1)}s)，跳过对齐`)
        // fallback: 直接用音频时长截取
        await cutAndRescale(videoPath, ts.start, Math.max(stepVideoDuration, 0.5), stepAudioDuration, clipVideoPath)
      } else {
        await cutAndRescale(videoPath, ts.start, stepVideoDuration, stepAudioDuration, clipVideoPath)
      }

      clipPaths.push(clipVideoPath)
    }

    // ── 处理登录视频 ──
    let loginDuration = 0
    const hyperframesClips: HyperframesClip[] = clipPaths.map((clipPath, index) => ({
      videoPath: clipPath,
      audioPath: audioPaths[index],
      duration: getMediaDuration(audioPaths[index]),
      title: clipMetadata[index]?.title,
      narration: clipMetadata[index]?.narration,
    }))

    if (loginVideoWebmPath && fs.existsSync(loginVideoWebmPath)) {
      console.log('[merger] 处理登录视频（2x 加速）...')
      loginDuration = await processLoginVideo(loginVideoWebmPath, loginMp4Path)
      hyperframesClips.unshift({
        videoPath: loginMp4Path,
        duration: loginDuration,
        title: '登录并进入产品',
        narration: null,
      })
    }

    try {
      const rendered = await renderHyperframesDemo(hyperframesClips, outputDir)

      // 清理 TTS 和中间片段，最终文件保留到上传完成后由上层清理目录。
      audioPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })
      clipPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })
      try { fs.unlinkSync(loginMp4Path) } catch {}

      console.log(`[merger] HyperFrames 合成完成: ${rendered.outputPath} (${rendered.duration}s)`)
      return { outputPath: rendered.outputPath, duration: rendered.duration, loginDuration }
    } catch (err) {
      console.warn(`[merger] HyperFrames 渲染失败，回退 FFmpeg concat: ${(err as Error).message}`)

      const fallbackClipPaths: string[] = []
      for (let i = 0; i < clipPaths.length; i++) {
        const clipFinalPath = path.join(outputDir, `clip_${i}.mp4`)
        await mergeClipWithAudio(clipPaths[i], audioPaths[i], clipFinalPath)
        fallbackClipPaths.push(clipFinalPath)
      }

      const demoMp4Path = path.join(outputDir, 'demo_aligned.mp4')
      if (fallbackClipPaths.length === 1) {
        fs.renameSync(fallbackClipPaths[0], demoMp4Path)
      } else {
        await concatVideos(fallbackClipPaths, demoMp4Path)
        fallbackClipPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })
      }

      if (loginDuration > 0 && fs.existsSync(loginMp4Path)) {
        await concatVideos([loginMp4Path, demoMp4Path], outputPath)
        try { fs.unlinkSync(loginMp4Path) } catch {}
        try { fs.unlinkSync(demoMp4Path) } catch {}
      } else {
        fs.renameSync(demoMp4Path, outputPath)
      }

      audioPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })
      clipPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })

      const totalDuration = Math.round(loginDuration + getMediaDuration(outputPath))
      return { outputPath, duration: totalDuration, loginDuration }
    }
  }

  // ── Fallback: 旧的简单合成逻辑 ────────────────────────────────
  console.log('[merger] Fallback: 使用简单合成（无步骤时间对齐）...')
  const concatAudioPath = path.join(outputDir, 'narration.wav')
  const demoMp4Path = path.join(outputDir, 'demo.mp4')

  await concatAudio(audioPaths, concatAudioPath)
  const audioDuration = getMediaDuration(concatAudioPath)

  await mergeVideoWithAudio(videoPath, concatAudioPath, demoMp4Path, audioDuration)
  fs.unlinkSync(concatAudioPath)
  audioPaths.forEach(p => { try { fs.unlinkSync(p) } catch {} })

  let loginDuration = 0
  if (loginVideoWebmPath && fs.existsSync(loginVideoWebmPath)) {
    loginDuration = await processLoginVideo(loginVideoWebmPath, loginMp4Path)
    await concatVideos([loginMp4Path, demoMp4Path], outputPath)
    try { fs.unlinkSync(loginMp4Path) } catch {}
    try { fs.unlinkSync(demoMp4Path) } catch {}
  } else {
    fs.renameSync(demoMp4Path, outputPath)
  }

  const totalDuration = Math.round(loginDuration + audioDuration)
  console.log(`[merger] 合成完成: ${outputPath} (${totalDuration}s)`)
  return { outputPath, duration: totalDuration, loginDuration }
}
