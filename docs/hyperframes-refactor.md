# Showrunner HyperFrames 重构说明

## 当前项目情况

Showrunner 当前是 `web` + `worker` 的双服务架构：

- `web`：Next.js 页面、API Routes、登录、Demo 创建和状态展示。
- `worker`：BullMQ 消费队列，负责步骤解析、Playwright 录制、Kokoro TTS、视频合成和上传。
- 数据流：`parse-queue` -> `record-queue` -> `tts-queue` -> `merge-queue`。

原视频合成集中在 `worker/src/services/merger/index.ts`，主要通过 FFmpeg 完成：

- 按步骤时间戳切割 Playwright 录屏。
- 将每段视频变速到对应 TTS 时长。
- 将每段视频和音频合并。
- 用 FFmpeg concat 拼成最终 `final.mp4`。

这个方案可用，但合成层和视觉包装耦合在 TypeScript + FFmpeg 参数里，后续要增加标题、进度条、字幕、转场、品牌包装时成本较高。

## 重构目标

本次重构把最终产品演示视频改成 HyperFrames composition 驱动：

- 继续保留现有 Playwright 自动录制能力。
- 继续保留 Kokoro 逐步骤旁白。
- FFmpeg 只负责必要的片段切割和时长对齐。
- HyperFrames 负责最终 timeline、画面布局、标题卡片、进度条、旁白音轨和 MP4 渲染。

## 新合成流程

```
record-queue
  Playwright 录制完整 WebM
  记录每步 start/end
    |
tts-queue
  生成每步 wav
  计算 TTS 时间轴
    |
merge-queue
  FFmpeg 切割每步 silent mp4
  生成 HyperFrames index.html
  hyperframes render -> final.mp4
  上传 R2 或本地视频目录
```

## 代码落点

- `worker/src/services/hyperframes/index.ts`
  - 生成 HyperFrames `index.html`。
  - 每个步骤对应一个 `<section data-start data-duration>`。
  - 每段包含屏幕录制 `<video>`、旁白 `<audio>`、步骤标题、旁白摘要和进度条。
  - 调用本地 `node_modules/.bin/hyperframes render` 输出 `final.mp4`。

- `worker/src/services/merger/index.ts`
  - 原有按步切割逻辑保留。
  - 优先用 HyperFrames 渲染最终视频。
  - HyperFrames 失败时回退到旧 FFmpeg concat，避免生产任务直接失败。

- `worker/src/workers/tts.worker.ts`
  - 把 `steps` 传给 `merge-queue`，供 HyperFrames 展示步骤标题和旁白文案。

- `worker/Dockerfile`
  - worker runtime 升级到 Node 22，匹配 HyperFrames 运行要求。

## 部署注意事项

HyperFrames 依赖 Node 22、Chrome/Chromium 和 FFmpeg。当前 worker Docker 镜像已包含系统 `chromium` 和 `ffmpeg`，并升级为 `node:22-slim`。

本地直接渲染时需要安装系统 `ffmpeg/ffprobe`；否则 `hyperframes doctor` 会提示 FFmpeg 不可用。
