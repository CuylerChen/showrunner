import fs from 'fs'
import path from 'path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

export type MediaToolName = 'ffmpeg' | 'ffprobe'

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

export function getMediaToolSearchDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const home = env.HOME

  return unique([
    home ? path.join(home, '.local/bin') : '',
    home ? path.join(home, '.ffmpeg/bin') : '',
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ])
}

export function resolveMediaToolPath(
  tool: MediaToolName,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = tool === 'ffmpeg' ? env.FFMPEG_PATH : env.FFPROBE_PATH
  if (override && fs.existsSync(override)) return override

  for (const dir of getMediaToolSearchDirs(env)) {
    const candidate = path.join(dir, tool)
    if (fs.existsSync(candidate)) return candidate
  }

  if (tool === 'ffmpeg') return ffmpegInstaller.path

  const packagedProbe = ffmpegInstaller.path.replace(/ffmpeg$/, 'ffprobe')
  return fs.existsSync(packagedProbe) ? packagedProbe : 'ffprobe'
}

export function createMediaToolEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const searchDirs = getMediaToolSearchDirs(env).filter(dir => fs.existsSync(dir))
  const pathParts = (env.PATH ?? '').split(path.delimiter).filter(Boolean)

  return {
    ...env,
    PATH: unique([...searchDirs, ...pathParts]).join(path.delimiter),
  }
}
