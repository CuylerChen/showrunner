import path from 'path'
import fs from 'fs'

// 使用持久化 volume 目录，避免容器重启后临时文件丢失导致 merge 失败
// /data/videos 是 docker-compose 中挂载的 named volume
const VIDEO_BASE = process.env.VIDEO_DIR ?? '/data/videos'
const ROOT = path.join(VIDEO_BASE, '_tmp')

export const Paths = {
  videoDir:  (demoId: string) => path.join(ROOT, demoId, 'video'),
  ttsDir:    (demoId: string) => path.join(ROOT, demoId, 'tts'),
  finalDir:  (demoId: string) => path.join(ROOT, demoId, 'final'),
  finalMp4:  (demoId: string) => path.join(ROOT, demoId, 'final', 'final.mp4'),

  ensureAll(demoId: string) {
    ;[this.videoDir(demoId), this.ttsDir(demoId), this.finalDir(demoId)]
      .forEach(dir => fs.mkdirSync(dir, { recursive: true }))
  },

  cleanup(demoId: string) {
    const demoRoot = path.join(ROOT, demoId)
    fs.rmSync(demoRoot, { recursive: true, force: true })
  },
}
