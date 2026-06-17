import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { pathToFileURL } from 'url'
import { Step } from '../../types'
import { createMediaToolEnv, resolveMediaToolPath } from '../../utils/media-tools'
import { getVideoStorageDir } from '../../utils/video-storage'
import { normalizeProductCategory, type ProductCategory } from '../parser/scenes'
import { getVideoStyleDescriptor, normalizeVideoStyleId, type VideoStyleId } from '../video-styles'

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
  brandName?: string | null
  visualType?: 'screenshot' | 'template' | 'cta'
  visualAssetPath?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  brandTone?: string | null
  kicker?: string | null
  proofPoints?: string[]
  ctaHeadline?: string | null
  visualStyle?: string | null
  styleId?: VideoStyleId | null
  brandColor?: string | null
  productType?: ProductCategory | null
}

const WIDTH = 1280
const HEIGHT = 720
const FPS = 30

function fileUrl(filePath: string): string {
  return pathToFileURL(path.resolve(filePath)).href
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
  return Math.max(0.1, seconds).toFixed(3)
}

function formatTimestamp(seconds: number): string {
  return Math.max(0, seconds).toFixed(3)
}

interface TimedAudioTrack {
  audioPath: string
  start: number
  duration: number
}

function compactExecError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const withOutput = error as Error & { stderr?: string; stdout?: string }
  const detail = (withOutput.stderr || withOutput.stdout || '').trim()
  if (!detail) return error.message

  return `${error.message}\n${detail.split(/\r?\n/).slice(-8).join('\n')}`
}

async function canProbeMedia(filePath: string): Promise<boolean> {
  try {
    await execFileAsync(resolveMediaToolPath('ffprobe'), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], {
      timeout: 15000,
      maxBuffer: 1024 * 256,
    })
    return true
  } catch {
    return false
  }
}

async function muxTimedAudioTracks(
  videoPath: string,
  outputPath: string,
  tracks: TimedAudioTrack[],
  totalDuration: number,
  label: string,
  options: { requireAudio?: boolean } = {},
): Promise<boolean> {
  const usableTracks = tracks.filter(track => (
    track.audioPath &&
    fs.existsSync(track.audioPath) &&
    Number.isFinite(track.start) &&
    Number.isFinite(track.duration) &&
    track.duration > 0
  ))

  if (usableTracks.length !== tracks.length) {
    const missing = tracks
      .filter(track => !track.audioPath || !fs.existsSync(track.audioPath))
      .map(track => track.audioPath || '<empty>')
    if (missing.length > 0) {
      const message = `${label} 音频文件缺失，无法写入这些音轨: ${missing.join(', ')}`
      if (options.requireAudio) throw new Error(message)
      console.warn(`[hyperframes] ${message}`)
    }
  }

  if (usableTracks.length === 0) {
    if (options.requireAudio) throw new Error(`${label} 没有可写入的音轨`)
    return false
  }

  if (!await canProbeMedia(videoPath)) {
    const message = `${label} 跳过音频后处理：无法探测视频文件 ${videoPath}`
    if (options.requireAudio) throw new Error(message)
    console.warn(`[hyperframes] ${message}`)
    return false
  }

  const ffmpegPath = resolveMediaToolPath('ffmpeg')
  const outputDir = path.dirname(outputPath)
  const audioMixPath = path.join(outputDir, `${path.basename(outputPath, path.extname(outputPath))}.mixed-audio.aac`)
  const muxOutputPath = path.join(outputDir, `${path.basename(outputPath, path.extname(outputPath))}.with-audio${path.extname(outputPath) || '.mp4'}`)
  const duration = formatDuration(totalDuration)
  const mixInputs = usableTracks.flatMap(track => ['-i', track.audioPath])
  const filterParts = usableTracks.map((track, index) => {
    const delayMs = Math.max(0, Math.round(track.start * 1000))
    return `[${index}:a]atrim=0:${formatDuration(track.duration)},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},apad=whole_dur=${duration}[a${index}]`
  })
  const mixLabels = usableTracks.map((_, index) => `[a${index}]`).join('')
  filterParts.push(`${mixLabels}amix=inputs=${usableTracks.length}:duration=longest:dropout_transition=0:normalize=0[mixed]`)

  try {
    await execFileAsync(ffmpegPath, [
      ...mixInputs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[mixed]',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', duration,
      '-y', audioMixPath,
    ], {
      env: createMediaToolEnv(),
      timeout: Math.max(120000, Math.ceil(totalDuration * 4000)),
      maxBuffer: 1024 * 1024 * 8,
    })

    await execFileAsync(ffmpegPath, [
      '-i', videoPath,
      '-i', audioMixPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-movflags', '+faststart',
      '-y', muxOutputPath,
    ], {
      env: createMediaToolEnv(),
      timeout: Math.max(120000, Math.ceil(totalDuration * 4000)),
      maxBuffer: 1024 * 1024 * 8,
    })

    fs.renameSync(muxOutputPath, outputPath)
    console.log(`[hyperframes] ${label} 已写入音轨: ${usableTracks.length} 段`)
    return true
  } catch (error) {
    throw new Error(`${label} 音频合成失败: ${compactExecError(error)}`)
  } finally {
    try { fs.unlinkSync(audioMixPath) } catch {}
    try { fs.unlinkSync(muxOutputPath) } catch {}
  }
}

function clipsToTimedAudioTracks(clips: HyperframesClip[]): TimedAudioTrack[] {
  let current = 0
  const tracks: TimedAudioTrack[] = []

  for (const clip of clips) {
    if (clip.audioPath) {
      tracks.push({
        audioPath: clip.audioPath,
        start: current,
        duration: clip.duration,
      })
    }
    current += clip.duration
  }

  return tracks
}

function scenesToTimedAudioTracks(scenes: PromotionalScene[]): TimedAudioTrack[] {
  let current = 0
  const tracks: TimedAudioTrack[] = []

  for (const scene of scenes) {
    if (scene.audioPath) {
      tracks.push({
        audioPath: scene.audioPath,
        start: current,
        duration: scene.duration,
      })
    }
    current += scene.duration
  }

  return tracks
}

function createStaticTimelineScript(totalDuration: number): string {
  const duration = formatDuration(totalDuration)

  return `<script>
    (function () {
      function createStaticTimeline(duration) {
        var current = 0;
        var rate = 1;
        return {
          duration: function () { return duration; },
          time: function () { return current; },
          seek: function (time) {
            current = Math.max(0, Math.min(duration, Number(time) || 0));
            return this;
          },
          totalTime: function (time) {
            if (typeof time === "number") this.seek(time);
            return current;
          },
          pause: function () { return this; },
          play: function () { return this; },
          timeScale: function (value) {
            if (typeof value === "number") rate = value;
            return rate;
          },
          getChildren: function () { return []; }
        };
      }
      window.__timelines = window.__timelines || {};
      window.__timelines["root"] = createStaticTimeline(${duration});
    })();
  </script>`
}

function resolveVisualAsset(value?: string | null): string | null {
  if (!value) return null
  if (value.startsWith('/videos/')) {
    const videoDir = getVideoStorageDir()
    return path.join(videoDir, value.replace(/^\/videos\//, ''))
  }
  if (fs.existsSync(value)) return value
  return null
}

function safeAssetExtension(filePath: string, fallback: string): string {
  const extension = path.extname(filePath).toLowerCase()
  if (/^\.[a-z0-9]{1,8}$/.test(extension)) return extension
  return fallback
}

function copyAssetIntoComposition(
  sourcePath: string | null,
  compositionDir: string,
  fileName: string,
): string | null {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null

  const assetsDir = path.join(compositionDir, 'assets')
  const targetPath = path.join(assetsDir, fileName)
  fs.mkdirSync(assetsDir, { recursive: true })

  if (path.resolve(sourcePath) !== path.resolve(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath)
  }

  return path.relative(compositionDir, targetPath).split(path.sep).join('/')
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
      <section id="clip-${index + 1}" class="clip" data-start="${formatTimestamp(start)}" data-duration="${formatDuration(clip.duration)}" data-track-index="0">
        <video class="screen" src="${escapeHtml(fileUrl(clip.videoPath))}" data-duration="${formatDuration(clip.duration)}" muted></video>
        ${clip.audioPath ? `<audio id="clip-${index + 1}-audio" class="clip audio-track" src="${escapeHtml(fileUrl(clip.audioPath))}" data-start="${formatTimestamp(start)}" data-duration="${formatDuration(clip.duration)}" data-track-index="1"></audio>` : ''}
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
    #root {
      position: relative;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background: #101418;
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
<body>
<div id="root" data-composition-id="root" data-start="0" data-width="${WIDTH}" data-height="${HEIGHT}" data-duration="${formatDuration(totalDuration)}" data-fps="${FPS}">
${layers}
</div>
${createStaticTimelineScript(totalDuration)}
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
    env: createMediaToolEnv(),
    timeout: Math.max(120000, Math.ceil(totalDuration * 8000)),
    maxBuffer: 1024 * 1024 * 8,
  })

  if (!fs.existsSync(outputPath)) {
    throw new Error(`HyperFrames 渲染完成但未找到输出文件: ${outputPath}`)
  }

  await muxTimedAudioTracks(
    outputPath,
    outputPath,
    clipsToTimedAudioTracks(clips),
    totalDuration,
    '分步视频',
  )

  return { outputPath, duration: Math.round(totalDuration) }
}

export function stepsToClipMetadata(steps?: Step[]): Pick<HyperframesClip, 'title' | 'narration'>[] {
  return (steps ?? []).map(step => ({
    title: step.title,
    narration: step.narration,
  }))
}

interface PromotionalSceneView {
  id: string
  scene: PromotionalScene
  start: number
  end: number
  duration: number
  visualSrc: string | null
  audioSrc: string | null
  kind: 'hero' | 'code' | 'screenshot' | 'flow' | 'cta'
}

const PRODUCT_NAV_LABELS: Record<ProductCategory, [string, string, string]> = {
  ecommerce: ['Products', 'Checkout', 'Offer'],
  developer_tool: ['Docs', 'SDK', 'Launch'],
  saas: ['Workflow', 'Proof', 'Demo'],
  local_service: ['Services', 'Booking', 'Visit'],
  content: ['Episodes', 'Learn', 'Subscribe'],
  generic: ['Story', 'Proof', 'Action'],
}

function compactText(value: string | null | undefined, fallback: string, maxLength: number): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim()
  return (normalized || fallback).slice(0, maxLength)
}

function displayUrl(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    const pathName = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')
    return `${parsed.origin}${pathName}`
  } catch {
    return raw
  }
}

function validHexColor(value: string | null | undefined): string | null {
  const color = value?.trim()
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null
}

function brandInitials(brandName: string): string {
  const words = brandName
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0] ?? brandName).slice(0, 2).toUpperCase()
}

function visualKind(scene: PromotionalScene, index: number, lastIndex: number): PromotionalSceneView['kind'] {
  if (index === lastIndex || scene.visualType === 'cta') return 'cta'
  if (index === 0) return 'hero'
  if (index === 1) return 'code'
  if (scene.visualType === 'screenshot' || scene.visualAssetPath) return 'screenshot'
  return 'flow'
}

function promotionalProductType(scenes: PromotionalScene[]): ProductCategory {
  return normalizeProductCategory(scenes.find(scene => scene.productType)?.productType)
}

function createPromotionalTimelineScript(views: PromotionalSceneView[], totalDuration: number): string {
  const duration = formatDuration(totalDuration)
  const timeline = views.map(view => ({
    id: view.id,
    start: Math.max(0, view.start - 0.35),
    end: view.end,
  }))

  return `<script>
    (function () {
      var DURATION = ${duration};
      var current = 0;
      var scenes = ${JSON.stringify(timeline)};

      function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
      function span(time, start, end) {
        if (end <= start) return time >= end ? 1 : 0;
        return clamp((time - start) / (end - start), 0, 1);
      }
      function smooth(value) { return value * value * (3 - 2 * value); }
      function expoOut(value) { return value === 1 ? 1 : 1 - Math.pow(2, -10 * value); }
      function fade(time, start, end) {
        var inProgress = smooth(span(time, start, start + 0.75));
        var outProgress = end >= DURATION ? 0 : smooth(span(time, end - 0.75, end));
        return clamp(inProgress * (1 - outProgress), 0, 1);
      }
      function setTransform(id, value) {
        var element = document.getElementById(id);
        if (element) element.style.transform = value;
      }
      function render(time) {
        current = clamp(Number(time) || 0, 0, DURATION);
        scenes.forEach(function (scene, index) {
          var element = document.getElementById(scene.id);
          if (!element) return;
          var opacity = fade(current, scene.start, scene.end);
          var entry = expoOut(span(current, scene.start, scene.start + 1));
          element.style.opacity = opacity.toFixed(4);
          element.style.transform = "translateY(" + ((1 - entry) * 18).toFixed(2) + "px) scale(" + (0.988 + opacity * 0.012).toFixed(4) + ")";
          setTransform("visual-" + (index + 1), "translate3d(" + ((1 - entry) * 28).toFixed(2) + "px," + (-6 * smooth(entry)).toFixed(2) + "px,0) scale(" + (0.96 + 0.04 * entry).toFixed(4) + ")");
        });
      }
      function createStaticTimeline(duration) {
        return {
          duration: function () { return duration; },
          time: function () { return current; },
          seek: function (time) { render(time); return this; },
          totalTime: function (time) {
            if (typeof time === "number") render(time);
            return current;
          },
          pause: function () { return this; },
          play: function () { return this; },
          timeScale: function () { return 1; },
          getChildren: function () { return []; }
        };
      }
      function boot() {
        render(0);
        window.__ready = true;
      }

      window.__timelines = window.__timelines || {};
      window.__timelines["root"] = createStaticTimeline(${duration});

      var images = Array.prototype.slice.call(document.images);
      Promise.all(images.map(function (image) {
        if (image.complete) return Promise.resolve();
        if (image.decode) return image.decode().catch(function () {});
        return new Promise(function (resolve) {
          image.onload = resolve;
          image.onerror = resolve;
        });
      })).then(function () {
        if (document.fonts && document.fonts.ready) return document.fonts.ready;
      }).then(boot).catch(boot);
    })();
  </script>`
}

function createPromotionalHtml(
  scenes: PromotionalScene[],
  totalDuration: number,
  compositionDir: string,
): string {
  let current = 0
  const defaultBrandName = compactText(scenes.find(scene => scene.brandName)?.brandName, 'Product', 80)
  const ctaText = compactText(scenes.find(scene => scene.ctaText)?.ctaText, 'Get started', 80)
  const finalUrl = scenes.find(scene => scene.ctaUrl)?.ctaUrl ?? ''
  const finalDisplayUrl = displayUrl(finalUrl)
  const brandPrimary = scenes.map(scene => validHexColor(scene.brandColor)).find(Boolean) ?? '#2563EB'
  const productType = promotionalProductType(scenes)
  const productClass = `product-${productType}`
  const selectedStyleId = normalizeVideoStyleId(scenes.find(scene => scene.styleId)?.styleId)
  const styleDescriptor = getVideoStyleDescriptor(selectedStyleId)
  const styleClass = styleDescriptor.className
  const navLabels = PRODUCT_NAV_LABELS[productType]
  const lastIndex = scenes.length - 1

  const views: PromotionalSceneView[] = scenes.map((scene, index) => {
    const start = current
    current += scene.duration
    const visualPath = resolveVisualAsset(scene.visualAssetPath)
    const visualSrc = copyAssetIntoComposition(
      visualPath,
      compositionDir,
      `visual-${index + 1}${visualPath ? safeAssetExtension(visualPath, '.png') : '.png'}`,
    )
    const audioSrc = copyAssetIntoComposition(
      scene.audioPath && fs.existsSync(scene.audioPath) ? scene.audioPath : null,
      compositionDir,
      `audio-${index + 1}${scene.audioPath ? safeAssetExtension(scene.audioPath, '.mp3') : '.mp3'}`,
    )

    return {
      id: `scene-${index + 1}`,
      scene,
      start,
      end: current,
      duration: scene.duration,
      visualSrc,
      audioSrc,
      kind: visualKind(scene, index, lastIndex),
    }
  })

  const audioTracks = views.map((view, index) => view.audioSrc
    ? `<audio id="scene-${index + 1}-audio" class="clip audio-track" src="${escapeHtml(view.audioSrc)}" data-start="${formatTimestamp(view.start)}" data-duration="${formatDuration(view.duration)}" data-track-index="1"></audio>`
    : ''
  ).join('\n')

  const renderBrowser = (view: PromotionalSceneView, className: string): string => view.visualSrc
    ? `<div class="browser ${className}" id="visual-${view.id.replace('scene-', '')}">
        <div class="traffic"><span></span><span></span><span></span></div>
        <img src="${escapeHtml(view.visualSrc)}" alt="">
      </div>`
    : ''

  const renderCodeCard = (view: PromotionalSceneView): string => `
      <div class="code-card" id="visual-${view.id.replace('scene-', '')}">
        <div class="dots"><span></span><span></span><span></span></div>
        <div class="code-line"><span class="code-key">brand:</span><span class="code-value">${escapeHtml(compactText(view.scene.brandName, defaultBrandName, 80))}</span></div>
        <div class="code-line"><span class="code-key">focus:</span><span class="code-value">${escapeHtml(compactText(view.scene.title, `Scene ${view.id.replace('scene-', '')}`, 96))}</span></div>
        <div class="code-line"><span class="code-key">proof:</span><span class="code-value">${escapeHtml(compactText(view.scene.proofPoints?.join(' / '), compactText(view.scene.visualStyle, 'product-specific value', 42), 96))}</span></div>
        <div class="code-line"><span class="code-key">tone:</span><span class="code-value">${escapeHtml(compactText(view.scene.brandTone, 'clear and useful', 42))}</span></div>
        <div class="code-line"><span class="code-key">action:</span><span class="code-accent">${escapeHtml(ctaText)}</span></div>
        ${finalDisplayUrl ? `<div class="code-line"><span class="code-key">link:</span><span class="code-value">${escapeHtml(finalDisplayUrl)}</span></div>` : ''}
      </div>`

  const flowSourceViews = views.filter(view => view.kind !== 'cta').slice(0, 4)
  const renderFlow = (view: PromotionalSceneView): string => {
    const sourceViews = flowSourceViews.length ? flowSourceViews : views.slice(0, 4)
    const flowCards = sourceViews.map((sourceView, index) => {
      const number = String(index + 1).padStart(2, '0')
      const title = escapeHtml(compactText(sourceView.scene.title, `Scene ${index + 1}`, 86))
      const body = escapeHtml(compactText(
        sourceView.scene.proofPoints?.join(' / '),
        compactText(sourceView.scene.narration, compactText(sourceView.scene.brandTone, 'Key product moment', 60), 104),
        104,
      ))
      return `<div class="flow-card"><span class="num">${number}</span><b>${title}</b><span>${body}</span></div>`
    }).join('')

    return `
      <div class="flow" id="flow-${view.id.replace('scene-', '')}">
        ${flowCards}
      </div>`
  }

  const sceneHtml = views.map((view, index) => {
    const scene = view.scene
    const rawTitle = view.kind === 'cta'
      ? compactText(scene.ctaHeadline, compactText(scene.title, `Scene ${index + 1}`, 120), 120)
      : compactText(scene.title, `Scene ${index + 1}`, 120)
    const title = escapeHtml(rawTitle)
    const narration = escapeHtml(compactText(scene.narration, '', 420))
    const kicker = escapeHtml(compactText(
      scene.kicker,
      view.kind === 'cta'
        ? 'Next step'
        : view.kind === 'code'
          ? 'How it works'
          : view.kind === 'screenshot'
            ? 'Product proof'
            : 'Product story',
      48,
    ))
    const progressWidth = `${Math.round(((index + 1) / views.length) * 100)}%`
    const browser = renderBrowser(view, view.kind === 'hero' ? 'hero-browser' : view.kind === 'cta' ? 'final-browser' : 'panel-browser')
    const visual = view.kind === 'cta'
      ? `
        ${browser}
        <div class="final-lockup">
          <div class="final-mark">${escapeHtml(brandInitials(compactText(scene.brandName, defaultBrandName, 80)))}</div>
          <h2>${title}</h2>
          ${narration ? `<p class="lead centered">${narration}</p>` : ''}
          ${finalDisplayUrl ? `<div class="final-url">${escapeHtml(finalDisplayUrl)}</div>` : ''}
        </div>
        ${renderFlow(view)}
      `
      : view.kind === 'code'
        ? renderCodeCard(view)
        : view.kind === 'flow'
          ? renderFlow(view)
          : browser || renderCodeCard(view)

    if (view.kind === 'cta') {
      return `
        <div id="${view.id}" class="scene scene-${view.kind}">
          ${visual}
          <div class="progress"><span style="width: ${progressWidth}"></span></div>
        </div>`
    }

    return `
        <div id="${view.id}" class="scene scene-${view.kind}">
          <div class="copy">
            <div class="kicker">${kicker}</div>
            <h1>${title}</h1>
            ${narration ? `<p class="lead">${narration}</p>` : ''}
            <div class="chips">
              <span class="chip">${escapeHtml(compactText(scene.brandName, defaultBrandName, 80))}</span>
              <span class="chip">${escapeHtml(compactText(scene.proofPoints?.[0], compactText(scene.brandTone, 'Product-led', 40), 40))}</span>
              <span class="chip">${escapeHtml(ctaText)}</span>
            </div>
            <div class="primary-cta">${escapeHtml(ctaText)}</div>
          </div>
          ${visual}
          <div class="progress"><span style="width: ${progressWidth}"></span></div>
        </div>`
  }).join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${WIDTH}, initial-scale=1" />
  <style>
    :root {
      --brand-primary: ${brandPrimary};
      --blue: var(--brand-primary);
      --blue-2: #1d4ed8;
      --mint: #10b981;
      --ink: #061226;
      --muted: #53657d;
      --paper: #f7faff;
      --line: #dbe6f4;
      --dark: #020817;
      --style-surface: #f7faff;
      --style-accent: var(--brand-primary);
      --style-ink: #061226;
      --style-muted: #53657d;
    }
    .style-bold-launch {
      --style-surface: #fff7ed;
      --style-accent: #f97316;
      --style-ink: #111827;
      --style-muted: #4b5563;
    }
    .style-warm-editorial {
      --style-surface: #fff7ed;
      --style-accent: #7c3a12;
      --style-ink: #3f2415;
      --style-muted: #6b4e3d;
    }
    .style-technical-dark {
      --style-surface: #020817;
      --style-accent: #38bdf8;
      --style-ink: #f8fafc;
      --style-muted: #94a3b8;
    }
    .style-premium-minimal {
      --style-surface: #fafaf9;
      --style-accent: #18181b;
      --style-ink: #18181b;
      --style-muted: #71717a;
    }
    .style-creator-social {
      --style-surface: #fdf2f8;
      --style-accent: #db2777;
      --style-ink: #1f2937;
      --style-muted: #6b7280;
    }
    * { box-sizing: border-box; }
    html, body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      margin: 0;
      overflow: hidden;
      background: var(--paper);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
    }
    #root {
      position: relative;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background: var(--style-surface);
    }
    .style-technical-dark #root {
      background: #020817;
    }
    .style-technical-dark .topbar,
    .style-technical-dark .code-card {
      color: #e5eefb;
    }
    .style-bold-launch h1,
    .style-bold-launch h2 {
      letter-spacing: 0;
    }
    .film, .scene {
      position: absolute;
      inset: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
    }
    .scene {
      opacity: 0;
      transform: translateY(18px) scale(0.99);
    }
    .topbar {
      position: absolute;
      left: 54px;
      right: 54px;
      top: 30px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 30;
      color: #1e2b3d;
    }
    .brand-lockup {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      max-width: 460px;
      font-weight: 850;
      font-size: 22px;
    }
    .brand-mark {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border-radius: 8px;
      background: white;
      color: var(--blue);
      border: 1px solid #dbe7f5;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
      font-size: 13px;
      font-weight: 900;
    }
    .brand-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 28px;
      color: #40516a;
      font-size: 13px;
      font-weight: 720;
    }
    .nav .button {
      min-width: 132px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 18px;
      border-radius: 8px;
      background: var(--blue);
      color: white;
      box-shadow: 0 14px 24px rgba(37, 99, 235, 0.25);
    }
    .copy {
      position: absolute;
      left: 76px;
      top: 154px;
      width: 530px;
      z-index: 3;
    }
    .kicker {
      display: inline-flex;
      align-items: center;
      height: 26px;
      padding: 0 12px;
      border: 1px solid rgba(37, 99, 235, 0.26);
      border-radius: 999px;
      color: var(--blue);
      background: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      line-height: 1;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    h1, h2 {
      margin: 20px 0 0;
      color: #061226;
      font-weight: 900;
      letter-spacing: 0;
    }
    h1 {
      max-width: 570px;
      font-size: 56px;
      line-height: 1.02;
      overflow-wrap: anywhere;
    }
    h2 {
      max-width: 760px;
      font-size: 52px;
      line-height: 1.04;
      overflow-wrap: anywhere;
    }
    .lead {
      margin: 20px 0 0;
      max-width: 500px;
      color: #40516a;
      font-size: 21px;
      line-height: 1.44;
      font-weight: 520;
    }
    .lead.centered {
      max-width: 760px;
      text-align: center;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 26px;
    }
    .chip {
      display: inline-flex;
      min-height: 32px;
      align-items: center;
      justify-content: center;
      max-width: 190px;
      padding: 0 13px;
      border: 1px solid #d8e2f0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.88);
      color: #33445b;
      font-size: 13px;
      font-weight: 760;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      box-shadow: 0 8px 18px rgba(31, 62, 110, 0.06);
    }
    .primary-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 156px;
      height: 52px;
      margin-top: 28px;
      padding: 0 22px;
      border-radius: 9px;
      background: var(--blue);
      color: white;
      font-size: 17px;
      font-weight: 820;
      box-shadow: 0 18px 34px rgba(37, 99, 235, 0.28);
    }
    .browser {
      position: absolute;
      overflow: hidden;
      border-radius: 14px;
      background: white;
      border: 1px solid rgba(189, 205, 226, 0.92);
      box-shadow: 0 30px 90px rgba(38, 57, 92, 0.16);
      transform-origin: center;
    }
    .browser::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      height: 32px;
      background: rgba(249, 251, 255, 0.96);
      border-bottom: 1px solid rgba(214, 225, 239, 0.9);
      z-index: 3;
    }
    .traffic {
      position: absolute;
      left: 14px;
      top: 11px;
      z-index: 4;
      display: flex;
      gap: 6px;
    }
    .traffic span {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #ff5f57;
    }
    .traffic span:nth-child(2) { background: #ffbd2e; }
    .traffic span:nth-child(3) { background: #28c840; }
    .browser img {
      position: absolute;
      left: 0;
      top: 32px;
      width: 100%;
      height: calc(100% - 32px);
      object-fit: cover;
    }
    .hero-browser {
      right: 62px;
      top: 104px;
      width: 560px;
      height: 514px;
    }
    .panel-browser {
      right: 64px;
      top: 170px;
      width: 600px;
      height: 340px;
    }
    .panel-browser img,
    .final-browser img {
      object-fit: contain;
      background: white;
    }
    .final-browser {
      right: 72px;
      bottom: 72px;
      width: 420px;
      height: 240px;
      opacity: 0.34;
    }
    .code-card {
      position: absolute;
      right: 74px;
      top: 142px;
      width: 560px;
      height: 376px;
      border-radius: 15px;
      padding: 30px 34px;
      background: var(--dark);
      color: #dbeafe;
      box-shadow: 0 34px 84px rgba(2, 8, 23, 0.32);
      border: 1px solid rgba(37, 99, 235, 0.28);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .code-card .dots {
      display: flex;
      gap: 8px;
      margin-bottom: 34px;
    }
    .code-card .dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ff5f57;
    }
    .code-card .dots span:nth-child(2) { background: #ffbd2e; }
    .code-card .dots span:nth-child(3) { background: #28c840; }
    .code-line {
      display: grid;
      grid-template-columns: 104px 1fr;
      gap: 20px;
      margin: 17px 0;
      font-size: 18px;
      line-height: 1.45;
    }
    .code-key { color: #70819e; }
    .code-value {
      color: #f8fbff;
      overflow-wrap: anywhere;
    }
    .code-accent { color: #7dd3fc; }
    .flow {
      position: absolute;
      right: 82px;
      top: 166px;
      width: 506px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .scene-cta .flow {
      left: 72px;
      right: auto;
      top: 470px;
      width: 520px;
      opacity: 0.92;
    }
    .flow-card {
      min-height: 114px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #dbe7f3;
      padding: 18px;
      box-shadow: 0 18px 46px rgba(38, 57, 92, 0.09);
    }
    .flow-card .num {
      display: inline-flex;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #07122a;
      color: white;
      font-size: 12px;
      font-weight: 850;
    }
    .flow-card b {
      display: block;
      margin-top: 12px;
      color: #061226;
      font-size: 17px;
      line-height: 1.12;
    }
    .flow-card span {
      display: block;
      margin-top: 8px;
      color: #607089;
      font-size: 12px;
      line-height: 1.36;
      font-weight: 560;
    }
    .final-lockup {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      text-align: center;
      z-index: 3;
    }
    .final-mark {
      width: 86px;
      height: 86px;
      border-radius: 24px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 56px rgba(37, 99, 235, 0.16);
      border: 1px solid #dbe7f5;
      color: var(--blue);
      font-size: 28px;
      font-weight: 900;
    }
    .final-url {
      margin-top: 20px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 780px;
      padding: 10px 22px;
      border-radius: 999px;
      color: #173b86;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #cfe0f8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 16px;
      font-weight: 720;
      overflow-wrap: anywhere;
    }
    .progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 5px;
      background: rgba(37, 99, 235, 0.13);
      z-index: 40;
    }
    .progress span {
      display: block;
      height: 100%;
      background: var(--blue);
    }
  </style>
</head>
<body class="${productClass} ${styleClass}" data-video-style="${selectedStyleId}">
<div id="root" class="${productClass} ${styleClass}" data-video-style="${selectedStyleId}" data-composition-id="root" data-start="0" data-width="${WIDTH}" data-height="${HEIGHT}" data-duration="${formatDuration(totalDuration)}" data-fps="${FPS}">
  <section id="film" class="clip film" data-start="0.000" data-duration="${formatDuration(totalDuration)}" data-track-index="0">
    ${audioTracks}
    <div class="topbar">
      <div class="brand-lockup"><span class="brand-mark">${escapeHtml(brandInitials(defaultBrandName))}</span><span class="brand-name">${escapeHtml(defaultBrandName)}</span></div>
      <div class="nav"><span>${escapeHtml(navLabels[0])}</span><span>${escapeHtml(navLabels[1])}</span><span>${escapeHtml(navLabels[2])}</span><span class="button">${escapeHtml(ctaText)}</span></div>
    </div>
${sceneHtml}
  </section>
</div>
${createPromotionalTimelineScript(views, totalDuration)}
</body>
</html>`
}

export async function renderPromotionalVideo(
  scenes: PromotionalScene[],
  outputDir: string,
  options: { requireAudio?: boolean } = {},
): Promise<HyperframesRenderResult> {
  if (scenes.length === 0) {
    throw new Error('没有可渲染的推广视频场景')
  }

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const compositionDir = path.join(outputDir, 'promo-hyperframes')
  const htmlPath = path.join(compositionDir, 'index.html')
  const outputPath = path.join(outputDir, 'final.mp4')

  fs.mkdirSync(compositionDir, { recursive: true })
  fs.writeFileSync(htmlPath, createPromotionalHtml(scenes, totalDuration, compositionDir))

  const bin = resolveHyperframesBin()
  const args = ['render', compositionDir, '--output', outputPath]

  console.log(`[hyperframes] 渲染推广视频 composition=${htmlPath}`)
  await execFileAsync(bin, args, {
    cwd: compositionDir,
    env: createMediaToolEnv(),
    timeout: Math.max(120000, Math.ceil(totalDuration * 8000)),
    maxBuffer: 1024 * 1024 * 8,
  })

  if (!fs.existsSync(outputPath)) {
    throw new Error(`HyperFrames 渲染完成但未找到输出文件: ${outputPath}`)
  }

  await muxTimedAudioTracks(
    outputPath,
    outputPath,
    scenesToTimedAudioTracks(scenes),
    totalDuration,
    '推广视频',
    options,
  )

  return { outputPath, duration: Math.round(totalDuration) }
}
