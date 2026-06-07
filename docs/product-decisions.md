# Showrunner — Demo Copilot
## 阶段性产品决策文档 v0.1
> 更新时间：2026-02-19

---

## 一、产品定位

**一句话描述**
B2B SaaS 产品的自动营销视频生成工具，用户粘贴产品 URL 并补充一个短 brief，系统自动生成带旁白、官网视觉素材、CTA 和分享页的 Product Story 视频。

**核心设计原则**
开箱即用 — 用户不需要看说明书，30 秒内完成输入并触发生成。

**目标用户**
- SaaS 创始人（自己做产品演示）
- 自由职业 Demo 制作人（帮客户批量生产）

---

## 二、用户体验流程

```
注册 / 登录
    ↓
输入产品 URL + 短 brief（受众、卖点、语气、CTA 可选）
    ↓
官网分析 + 截图捕获 → AI 生成 Product Story 场景
    ↓
用户确认 / 编辑场景 → 触发后台生成任务
    ↓
TTS 旁白 → HyperFrames 合成官网截图、动态图形和 CTA
    ↓
素材抓取失败 → 使用模板动态图形兜底
    ↓
生成交互分享页 + 视频文件
```

**极简输入设计**
- 用户永远看不到 YAML / JSON / 代码
- 修改 Product Story 场景用卡片拖拽 + 点选，不填表单
- 失败信息对用户友好，不暴露技术错误

---

## 三、功能路线图

### Phase 1 — Web MVP（当前目标）

| 功能 | 说明 |
|------|------|
| 注册 / 登录 | 自管账号体系 + JWT，支持邮箱登录 |
| URL 输入 + brief | 产品 URL 必填，受众、卖点、品牌语气、CTA 可选 |
| AI 场景生成 | OpenAI-compatible Chat Completions 生成 Product Story 场景卡片 |
| 场景卡片编辑 | 拖拽排序、删除、标题和旁白修改 |
| 官网分析与截图 | 抓取公开页面内容，捕获首页/功能/价格等视觉素材 |
| TTS 旁白生成 | Kokoro（英文主，中文辅） |
| 视频合成 | HyperFrames 合成官网截图 + 动态包装 + 旁白 |
| 素材兜底 | 官网抓取或截图失败时使用模板动态图形 |
| 交互分享页 | 视频播放器 + 场景导航（可跳转时间节点） + CTA |
| 订阅集成 | LemonSqueezy Freemium |

### Phase 2 — 增长功能

| 功能 | 说明 |
|------|------|
| 品牌定制 | Logo、颜色、字体 |
| 批量生成 | 多条营销视频并行生成 |
| Analytics | 观看次数、步骤 drop-off |
| 团队协作 | 多成员共管脚本库 |

### Phase 3 — 竞争壁垒

| 功能 | 说明 |
|------|------|
| Live Co-pilot | 会议中远程操控浏览器 |
| 多路径演示 | A/B 场景预加载切换 |

---

## 四、分享页设计

```
┌─────────────────────────────────────┐
│  ▶ 视频播放器                        │
│  ─────────────────────────────────  │
│  Scene 1  痛点开场         ✅       │
│  Scene 2  产品价值         ✅ ← 当前│
│  Scene 3  核心卖点         ○        │
│  Scene 4  CTA              ○        │
│                                     │
│  点击场景跳转到对应视频时间节点       │
└─────────────────────────────────────┘
```

---

## 五、商业模式

**定价方案**

| 方案 | 价格 | 额度 |
|------|------|------|
| 免费 | $0 | 注册后首次免费 1 次 |
| Starter | $19 / 月 | 10 次 / 月 |
| Pro | $49 / 月 | 无限次 + 品牌定制 |

**付费触发节点**
用户注册后生成第一个 Demo（免费），结果页出现订阅引导。
用户无额度时，点击生成弹出内嵌付费弹窗，不跳转页面。

**订阅工具**：LemonSqueezy（自动处理全球税务）

---

## 六、技术栈

| 模块 | 技术选型 |
|------|----------|
| 前端 | Next.js + Tailwind CSS |
| Auth | 自管用户表 + JWT Cookie |
| 数据库 | MySQL + Drizzle ORM |
| 文件存储 | R2 或本地视频目录 |
| 任务队列 | BullMQ + Redis |
| Worker | Node.js + Playwright 截图 + Kokoro + HyperFrames + FFmpeg |
| AI 场景生成 | OpenAI-compatible Chat Completions 接口 |
| TTS | Kokoro 默认；可选独立 OpenAI TTS（不走 Chat Completions gateway） |
| 订阅支付 | LemonSqueezy |
| 前端部署 | Vercel |
| Worker 部署 | Railway |

**TTS 升级策略**
MVP 阶段默认使用 Kokoro（免费开源）。需要更强商业旁白时，单独配置 `OPENAI_TTS_*` 直连支持 `/audio/speech` 的 TTS 服务，不复用自建 Chat Completions gateway。

---

## 七、MVP 功能边界

**做**
- 注册登录
- URL + brief 输入
- AI Product Story 场景生成与卡片编辑
- 官网公开内容抓取与截图捕获
- TTS 旁白 + 字幕
- 素材兜底动态图形
- 交互分享页 + CTA
- LemonSqueezy 订阅

**不做（Phase 1 明确排除）**
- 团队协作
- 品牌定制
- Live Co-pilot
- Analytics
- 批量生成
- 真实浏览器点击录制主路径（旧录制能力仅作为 legacy / deprecated 能力保留，不进入当前 MVP 主流程）

---

## 八、下一步

- [ ] 数据库表结构设计
- [ ] 系统架构图（前端 / Worker / 队列 交互流程）
- [ ] API 接口设计
- [ ] 项目初始化（Next.js + MySQL + Railway）
