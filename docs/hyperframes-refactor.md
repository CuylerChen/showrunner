# Showrunner HyperFrames 重构说明

## 当前项目情况

Showrunner 当前是 `web` + `worker` 的双服务架构，主路径已经从真实浏览器点击录制转为营销视频生成：

- `web`：Next.js 页面、API Routes、登录、Demo 创建和状态展示。
- `worker`：BullMQ 消费队列，负责官网公开内容抓取、Playwright 截图捕获、Product Story 场景生成、Kokoro TTS、HyperFrames 视频合成和上传。
- 数据流：`parse-queue` -> `tts-queue` -> `merge-queue`。
- `record-queue` 和真实浏览器点击录制服务仅作为 legacy / deprecated 路径保留，不是当前目标架构。

旧视频合成集中在 `worker/src/services/merger/index.ts`，主要通过 FFmpeg 完成：

- 按步骤时间戳切割 Playwright 录屏。
- 将每段视频变速到对应 TTS 时长。
- 将每段视频和音频合并。
- 用 FFmpeg concat 拼成最终 `final.mp4`。

这个真实录制合并方案现在是兼容路径。Marketing Video MVP 的主路径不再依赖录屏片段，而是把官网截图和模板动态图形交给 HyperFrames 渲染成 Product Story 视频。

## 重构目标

本次重构把最终 Product Story 营销视频改成 HyperFrames composition 驱动：

- 使用 Playwright 捕获官网首页、功能页、价格页等公开视觉素材。
- 官网抓取或截图不可用时，使用模板动态图形兜底。
- 继续保留 Kokoro 逐步骤旁白。
- FFmpeg 只作为音视频工具链依赖，真实录制切片合并不再是目标架构。
- HyperFrames 负责最终 timeline、官网截图舞台、动态包装、标题、进度、CTA、旁白音轨和 MP4 渲染。

## 新合成流程

```
parse-queue
  抓取官网公开内容
  Playwright 捕获可用官网截图
  AI 生成 Product Story 场景
  写入 steps.visual_type / steps.visual_asset_url
    |
tts-queue
  为每个场景生成 wav
  计算场景时间轴
    |
merge-queue
  生成 HyperFrames index.html
  渲染官网截图 + 模板动态图形 + CTA
  hyperframes render -> final.mp4
  上传 R2 或本地视频目录
```

## 代码落点

- `worker/src/services/hyperframes/index.ts`
  - 生成 HyperFrames `index.html`。
  - 每个步骤对应一个 `<section data-start data-duration>`。
  - 每段包含官网截图或模板视觉、旁白 `<audio>`、场景标题、旁白摘要、进度条和 CTA。
  - 调用本地 `node_modules/.bin/hyperframes render` 输出 `final.mp4`。

- `worker/src/services/merger/index.ts`
  - 主路径使用 HyperFrames 渲染最终营销视频。
  - 旧 FFmpeg concat 录制合并仅作为 deprecated legacy recorder 兼容路径，不是当前目标架构。

- `worker/src/workers/tts.worker.ts`
  - 把 `steps` 场景传给 `merge-queue`，供 HyperFrames 展示标题、旁白文案和视觉素材。

- `worker/src/services/parser/assets.ts`
  - 用 Playwright 捕获公开页面截图。
  - 截图失败时不阻塞主流程，场景回退到 `visual_type = template`。

- `worker/Dockerfile`
  - worker runtime 升级到 Node 22，匹配 HyperFrames 运行要求。

## 部署注意事项

HyperFrames 主路径依赖 Node 22、Chrome/Chromium 和 FFmpeg。Chromium 用于官网截图捕获，不用于主路径的真实浏览器点击录制。当前 worker Docker 镜像已包含系统 `chromium` 和 `ffmpeg`，并升级为 `node:22-slim`。

本地直接渲染时需要安装系统 `ffmpeg/ffprobe`；否则 `hyperframes doctor` 会提示 FFmpeg 不可用。
