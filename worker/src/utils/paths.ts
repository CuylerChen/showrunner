import path from 'path'
import fs from 'fs'
import os from 'os'

// 所有临时文件统一放在系统临时目录下，Railway 重启后自动清理
const ROOT = path.join(os.tmpdir(), 'showrunner')

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
