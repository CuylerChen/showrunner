import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Step } from '../../types'

const execFileAsync = promisify(execFile)

export interface HyperframesClip {
  videoPath: string
  audioPath?: string
  duration: number
  title?: string
  narration?: string | null
}

export interface HyperframesRenderResult {
  outputPath: string
  duration: number
}

export interface PromotionalScene {
  title: string
  narration?: string | null
  audioPath?: string
  duration: number
  visualType?: 'screenshot' | 'template' | 'cta'
  visualAssetPath?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  brandTone?: string | null
}

const WIDTH = 1280
const HEIGHT = 720
const FPS = 30

function fileUrl(filePath: string): string {
  return `file://${path.resolve(filePath)}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDuration(seconds: number): string {
  return `${Math.max(0.1, seconds).toFixed(3)}s`
}

function resolveVisualAsset(value?: string | null): string | null {
  if (!value) return null
  if (value.startsWith('/videos/')) {
    const videoDir = process.env.VIDEO_DIR ?? '/data/videos'
    return path.join(videoDir, value.replace(/^\/videos\//, ''))
  }
  if (fs.existsSync(value)) return value
  return null
}

function resolveHyperframesBin(): string {
  const localBin = path.resolve(process.cwd(), 'node_modules/.bin/hyperframes')
  if (fs.existsSync(localBin)) return localBin
  return 'hyperframes'
}

function createCompositionHtml(clips: HyperframesClip[], totalDuration: number): string {
  let current = 0

  const layers = clips.map((clip, index) => {
    const start = current
    current += clip.duration
    const title = clip.title ? escapeHtml(clip.title) : `Step ${index + 1}`
    const narration = clip.narration ? escapeHtml(clip.narration) : ''
    const progressWidth = `${Math.round(((index + 1) / clips.length) * 100)}%`

    return `
      <section class="clip" data-start="${formatDuration(start)}" data-duration="${formatDuration(clip.duration)}">
        <video class="screen" src="${fileUrl(clip.videoPath)}" data-duration="${formatDuration(clip.duration)}" muted></video>
        ${clip.audioPath ? `<audio src="${fileUrl(clip.audioPath)}" data-duration="${formatDuration(clip.duration)}"></audio>` : ''}
        <div class="chrome">
          <div class="traffic">
            <span></span><span></span><span></span>
          </div>
          <div class="address">showrunner product demo</div>
        </div>
        <div class="step">
          <div class="step-kicker">Step ${index + 1} / ${clips.length}</div>
          <div class="step-title">${title}</div>
          ${narration ? `<div class="step-caption">${narration}</div>` : ''}
        </div>
        <div class="progress"><span style="width: ${progressWidth}"></span></div>
      </section>
    `
  }).join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${WIDTH}, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      margin: 0;
      overflow: hidden;
      background: #101418;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      position: relative;
      color: #f7fafc;
    }
    .clip {
      position: absolute;
      inset: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      background: #101418;
      overflow: hidden;
    }
    .screen {
      position: absolute;
      inset: 34px 0 0 0;
      width: ${WIDTH}px;
      height: 686px;
      object-fit: cover;
      background: #0b0f14;
    }
    .chrome {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 34px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 0 16px;
      background: #18202a;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .traffic {
      display: flex;
      gap: 7px;
      flex: 0 0 auto;
    }
    .traffic span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ff5f57;
    }
    .traffic span:nth-child(2) { background: #ffbd2e; }
    .traffic span:nth-child(3) { background: #28c840; }
    .address {
      height: 20px;
      min-width: 0;
      flex: 1;
      border-radius: 5px;
      background: #10161d;
      color: #8fa3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      letter-spacing: 0;
    }
    .step {
      position: absolute;
      left: 28px;
      bottom: 30px;
      width: 430px;
      padding: 16px 18px;
      border-radius: 8px;
      background: rgba(14, 19, 25, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.32);
    }
    .step-kicker {
      margin-bottom: 6px;
      color: #72d0ff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .step-title {
      font-size: 24px;
      line-height: 1.18;
      font-weight: 760;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .step-caption {
      margin-top: 8px;
      color: #d6e1ec;
      font-size: 14px;
      line-height: 1.4;
      max-height: 60px;
      overflow: hidden;
    }
    .progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 5px;
      background: rgba(255, 255, 255, 0.16);
    }
    .progress span {
      display: block;
      height: 100%;
      background: #42c6ff;
    }
  </style>
</head>
<body data-duration="${formatDuration(totalDuration)}" data-fps="${FPS}" data-width="${WIDTH}" data-height="${HEIGHT}">
${layers}
</body>
</html>`
}

export async function renderHyperframesDemo(
  clips: HyperframesClip[],
  outputDir: string,
): Promise<HyperframesRenderResult> {
  if (clips.length === 0) {
    throw new Error('没有可渲染的视频片段')
  }

  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0)
  const compositionDir = path.join(outputDir, 'hyperframes')
  const htmlPath = path.join(compositionDir, 'index.html')
  const outputPath = path.join(outputDir, 'final.mp4')

  fs.mkdirSync(compositionDir, { recursive: true })
  fs.writeFileSync(htmlPath, createCompositionHtml(clips, totalDuration))

  const bin = resolveHyperframesBin()
  const args = ['render', compositionDir, '--output', outputPath]

  console.log(`[hyperframes] 渲染 composition=${htmlPath}`)
  await execFileAsync(bin, args, {
    cwd: compositionDir,
    timeout: Math.max(120000, Math.ceil(totalDuration * 8000)),
    maxBuffer: 1024 * 1024 * 8,
  })

  if (!fs.existsSync(outputPath)) {
    throw new Error(`HyperFrames 渲染完成但未找到输出文件: ${outputPath}`)
  }

  return { outputPath, duration: Math.round(totalDuration) }
}

export function stepsToClipMetadata(steps?: Step[]): Pick<HyperframesClip, 'title' | 'narration'>[] {
  return (steps ?? []).map(step => ({
    title: step.title,
    narration: step.narration,
  }))
}

function createPromotionalHtml(scenes: PromotionalScene[], totalDuration: number): string {
  let current = 0

  const layers = scenes.map((scene, index) => {
    const start = current
    current += scene.duration
    const title = escapeHtml(scene.title || `Scene ${index + 1}`)
    const narration = scene.narration ? escapeHtml(scene.narration) : ''
    const progressWidth = `${Math.round(((index + 1) / scenes.length) * 100)}%`
    const visualClass = `visual-${index % 4}`
    const visualPath = resolveVisualAsset(scene.visualAssetPath)
    const visual = visualPath
      ? `<div class="screenshot-stage"><img src="${escapeHtml(fileUrl(visualPath))}" /></div>`
      : `
          <div class="panel panel-a"></div>
          <div class="panel panel-b"></div>
          <div class="panel panel-c"></div>
        `
    const ctaText = scene.visualType === 'cta' && scene.ctaText ? escapeHtml(scene.ctaText) : ''

    return `
      <section class="scene ${visualClass}" data-start="${formatDuration(start)}" data-duration="${formatDuration(scene.duration)}">
        ${scene.audioPath ? `<audio src="${fileUrl(scene.audioPath)}" data-duration="${formatDuration(scene.duration)}"></audio>` : ''}
        <div class="brand">Showrunner</div>
        <div class="scene-index">${String(index + 1).padStart(2, '0')}</div>
        <div class="copy">
          <div class="kicker">Product Video</div>
          <h1>${title}</h1>
          ${narration ? `<p>${narration}</p>` : ''}
          ${ctaText ? `<div class="cta-pill">${ctaText}</div>` : ''}
        </div>
        <div class="visual">
          ${visual}
        </div>
        <div class="progress"><span style="width: ${progressWidth}"></span></div>
      </section>
    `
  }).join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${WIDTH}, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      margin: 0;
      overflow: hidden;
      background: #0d1117;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #f8fafc;
    }
    .scene {
      position: absolute;
      inset: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background: linear-gradient(135deg, #0d1117 0%, #172033 52%, #0f766e 100%);
    }
    .scene::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
    }
    .visual-1 { background: linear-gradient(135deg, #111827 0%, #1f2937 48%, #7c3aed 100%); }
    .visual-2 { background: linear-gradient(135deg, #101418 0%, #164e63 52%, #2563eb 100%); }
    .visual-3 { background: linear-gradient(135deg, #111827 0%, #365314 48%, #0891b2 100%); }
    .brand {
      position: absolute;
      left: 48px;
      top: 38px;
      font-size: 18px;
      font-weight: 760;
      letter-spacing: 0;
      color: rgba(255,255,255,0.88);
    }
    .scene-index {
      position: absolute;
      right: 52px;
      top: 34px;
      font-size: 40px;
      line-height: 1;
      font-weight: 800;
      color: rgba(255,255,255,0.2);
    }
    .copy {
      position: absolute;
      left: 72px;
      top: 170px;
      width: 640px;
      z-index: 2;
    }
    .kicker {
      margin-bottom: 20px;
      color: #67e8f9;
      font-size: 15px;
      line-height: 1;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    h1 {
      margin: 0;
      color: #ffffff;
      font-size: 58px;
      line-height: 1.02;
      font-weight: 820;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    p {
      margin: 26px 0 0;
      width: 560px;
      color: #dbeafe;
      font-size: 24px;
      line-height: 1.38;
      font-weight: 460;
      letter-spacing: 0;
    }
    .visual {
      position: absolute;
      right: 70px;
      bottom: 92px;
      width: 420px;
      height: 390px;
    }
    .screenshot-stage {
      position: absolute;
      inset: 0;
      overflow: hidden;
      border-radius: 8px;
      background: rgba(15,23,42,0.82);
      border: 1px solid rgba(255,255,255,0.22);
      box-shadow: 0 30px 80px rgba(0,0,0,0.34);
    }
    .screenshot-stage img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .panel {
      position: absolute;
      border-radius: 8px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      box-shadow: 0 30px 80px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
    }
    .panel-a {
      right: 0;
      top: 0;
      width: 340px;
      height: 230px;
    }
    .panel-b {
      left: 0;
      bottom: 40px;
      width: 250px;
      height: 150px;
      background: rgba(255,255,255,0.16);
    }
    .panel-c {
      right: 34px;
      bottom: 0;
      width: 190px;
      height: 96px;
      background: rgba(103,232,249,0.22);
    }
    .cta-pill {
      display: inline-flex;
      align-items: center;
      max-width: 560px;
      min-height: 54px;
      margin-top: 30px;
      padding: 0 26px;
      border-radius: 999px;
      background: #67e8f9;
      color: #0f172a;
      font-size: 22px;
      line-height: 1.1;
      font-weight: 820;
      letter-spacing: 0;
      box-shadow: 0 18px 42px rgba(8,145,178,0.34);
      overflow-wrap: anywhere;
    }
    .progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 6px;
      background: rgba(255,255,255,0.18);
    }
    .progress span {
      display: block;
      height: 100%;
      background: #67e8f9;
    }
  </style>
</head>
<body data-duration="${formatDuration(totalDuration)}" data-fps="${FPS}" data-width="${WIDTH}" data-height="${HEIGHT}">
${layers}
</body>
</html>`
}

export async function renderPromotionalVideo(
  scenes: PromotionalScene[],
  outputDir: string,
): Promise<HyperframesRenderResult> {
  if (scenes.length === 0) {
    throw new Error('没有可渲染的推广视频场景')
  }

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const compositionDir = path.join(outputDir, 'promo-hyperframes')
  const htmlPath = path.join(compositionDir, 'index.html')
  const outputPath = path.join(outputDir, 'final.mp4')

  fs.mkdirSync(compositionDir, { recursive: true })
  fs.writeFileSync(htmlPath, createPromotionalHtml(scenes, totalDuration))

  const bin = resolveHyperframesBin()
  const args = ['render', compositionDir, '--output', outputPath]

  console.log(`[hyperframes] 渲染推广视频 composition=${htmlPath}`)
  await execFileAsync(bin, args, {
    cwd: compositionDir,
    timeout: Math.max(120000, Math.ceil(totalDuration * 8000)),
    maxBuffer: 1024 * 1024 * 8,
  })

  if (!fs.existsSync(outputPath)) {
    throw new Error(`HyperFrames 渲染完成但未找到输出文件: ${outputPath}`)
  }

  return { outputPath, duration: Math.round(totalDuration) }
}
