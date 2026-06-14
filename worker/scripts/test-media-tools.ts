import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createMediaToolEnv,
  resolveMediaToolPath,
} from '../src/utils/media-tools'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'showrunner-media-tools-'))
const localBin = path.join(tmpHome, '.local/bin')
const ffmpegPath = path.join(localBin, 'ffmpeg')
const ffprobePath = path.join(localBin, 'ffprobe')

fs.mkdirSync(localBin, { recursive: true })
fs.writeFileSync(ffmpegPath, '')
fs.writeFileSync(ffprobePath, '')
fs.chmodSync(ffmpegPath, 0o755)
fs.chmodSync(ffprobePath, 0o755)

try {
  const env = {
    HOME: tmpHome,
    PATH: '/custom/bin',
  } as NodeJS.ProcessEnv

  assert.equal(resolveMediaToolPath('ffmpeg', env), ffmpegPath)
  assert.equal(resolveMediaToolPath('ffprobe', env), ffprobePath)

  const mediaEnv = createMediaToolEnv(env)
  const pathParts = String(mediaEnv.PATH).split(path.delimiter)
  assert.equal(pathParts[0], localBin)
  assert.equal(pathParts.at(-1), '/custom/bin')
} finally {
  fs.rmSync(tmpHome, { recursive: true, force: true })
}

console.log('media tool path tests passed')
