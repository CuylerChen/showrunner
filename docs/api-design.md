# Showrunner — API 接口设计
> 版本：v0.1 | 更新时间：2026-02-19
> 框架：Next.js API Routes | 认证：自管 JWT Cookie

---

## 一、设计原则

- **RESTful 风格**，资源路径清晰
- **统一响应格式**，成功/失败结构一致
- **职责解耦**，Worker 直写 MySQL，不经过 Next.js API
- **Webhook 独立分组**，与业务接口隔离
- **公开接口**（分享页）无需鉴权，其余全部需要 JWT 登录态

---

## 二、统一响应格式

```typescript
// 成功
{
  "success": true,
  "data": { ... }
}

// 失败
{
  "success": false,
  "error": {
    "code": "DEMO_NOT_FOUND",
    "message": "Demo 不存在或无权访问"
  }
}
```

**错误码清单**

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `UNAUTHORIZED` | 401 | 未登录 |
| `FORBIDDEN` | 403 | 无权限 |
| `DEMO_NOT_FOUND` | 404 | Demo 不存在 |
| `QUOTA_EXCEEDED` | 402 | 额度不足 |
| `DEMO_NOT_READY` | 409 | Demo 状态不允许此操作 |
| `VALIDATION_ERROR` | 422 | 参数校验失败 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 三、API 分组总览

```
/api
  /demos              Demo 核心 CRUD + 生命周期
  /demos/[id]/steps   步骤管理
  /share              公开分享页（无需鉴权）
  /subscription       套餐与额度
  /webhooks           第三方回调（LemonSqueezy）
```

---

## 四、Demo 接口

### 4.1 创建 Demo
```
POST /api/demos
Auth: 必须
```

**Request**
```json
{
  "product_url": "https://app.example.com",
  "audience": "Sales teams",
  "key_points": "Automates follow-up, improves conversion",
  "brand_tone": "confident",
  "cta_text": "Book a demo",
  "cta_url": "https://app.example.com/demo"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "parsing",
    "share_token": "abc123"
  }
}
```

**逻辑**
1. 检查用户额度（`demos_used_this_month < demos_limit`）
2. 创建 `demos` 记录，status = `parsing`
3. 入队 `parse-queue`，Worker 异步抓取官网、截图并生成 Product Story 场景
4. 返回 `demo_id`，前端查询后续状态

---

### 4.2 获取 Demo 列表
```
GET /api/demos
Auth: 必须
```

**Query Params**
```
?page=1&limit=20&status=completed
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Product Demo v1",
        "product_url": "https://app.example.com",
        "status": "completed",
        "duration": 42,
        "share_token": "abc123",
        "created_at": "2026-02-19T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

---

### 4.3 获取 Demo 详情
```
GET /api/demos/[id]
Auth: 必须
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Product Demo v1",
    "product_url": "https://app.example.com",
    "description": "Launch angle and constraints",
    "audience": "Sales teams",
    "key_points": "Automates follow-up, improves conversion",
    "brand_tone": "confident",
    "cta_text": "Book a demo",
    "cta_url": "https://app.example.com/demo",
    "status": "review",
    "video_url": null,
    "duration": null,
    "share_token": "abc123",
    "error_message": null,
    "steps": [
      {
        "id": "uuid",
        "position": 1,
        "title": "Launch your sales follow-up in minutes",
        "action_type": "navigate",
        "selector": null,
        "value": null,
        "narration": "Show how the product turns messy follow-up into a clear next action.",
        "visual_type": "screenshot",
        "visual_asset_url": "/videos/demo-id/assets/home.png",
        "status": "pending"
      }
    ],
    "created_at": "2026-02-19T10:00:00Z"
  }
}
```

---

### 4.4 更新 Demo 标题
```
PATCH /api/demos/[id]
Auth: 必须
```

**Request**
```json
{
  "title": "Onboarding Demo v2"
}
```

**Response 200**
```json
{
  "success": true,
  "data": { "id": "uuid", "title": "Onboarding Demo v2" }
}
```

---

### 4.5 确认场景，开始生成视频
```
POST /api/demos/[id]/start
Auth: 必须
```

> 用户在场景卡片页面确认后调用此接口，触发旁白和营销视频合成。

**Request**：无 body

**Response 200**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "processing" }
}
```

**逻辑**
1. 校验 `demo.status === 'review'`，否则返回 `DEMO_NOT_READY`
2. 更新 status = `processing`
3. 入队 `tts-queue`，携带 ordered scenes 与 `renderMode = promotional`

---

### 4.6 旧录制失败后用户介入（deprecated / 非主流程）
```
POST /api/demos/[id]/steps/[stepId]/resolve
Auth: 必须
```

**Request**
```json
{
  "action": "skip" | "retry" | "manual",
  "manual_description": "点击右上角的 Export 按钮"  // action=manual 时必填
}
```

**Response 200**
```json
{
  "success": true,
  "data": { "demo_id": "uuid", "status": "recording" }
}
```

**逻辑**
- `skip`：将该 step 标记为 `skipped`，继续录制下一步
- `retry`：将该 step 重新入队重试
- `manual`：用 AI 重新解析用户描述，更新 step，再重试

> 当前营销视频 MVP 主路径不再使用真实浏览器点击录制；官网抓取或截图失败时直接使用模板动态图形兜底。

---

### 4.7 删除 Demo
```
DELETE /api/demos/[id]
Auth: 必须
```

**Response 200**
```json
{
  "success": true,
  "data": { "id": "uuid" }
}
```

**逻辑**：删除 R2 / 本地视频文件 + 数据库记录

---

## 五、场景接口

### 5.1 批量更新场景（编辑 + 排序）
```
PUT /api/demos/[id]/steps
Auth: 必须
```

> 用户在 Product Story 场景卡片页拖拽排序或修改文字后，整体提交。

**Request**
```json
{
  "steps": [
    {
      "id": "uuid",
      "position": 1,
      "title": "Launch your sales follow-up in minutes",
      "narration": "Show how the product turns messy follow-up into a clear next action.",
      "visual_type": "screenshot",
      "visual_asset_url": "/videos/demo-id/assets/home.png"
    },
    {
      "id": "uuid",
      "position": 2,
      "title": "Turn every lead into a guided workflow",
      "narration": "Highlight the benefit with a concise product story beat.",
      "visual_type": "template",
      "visual_asset_url": null
    }
  ]
}
```

**Response 200**
```json
{
  "success": true,
  "data": { "updated": 2 }
}
```

---

## 六、分享页接口（公开，无需鉴权）

### 6.1 获取分享页数据
```
GET /api/share/[token]
Auth: 无需
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "title": "Product Demo v1",
    "video_url": "https://cdn.example.com/videos/xxx/final.mp4",
    "duration": 42,
    "steps": [
      {
        "position": 1,
        "title": "Hook: faster sales follow-up",
        "timestamp_start": 0,
        "timestamp_end": 12.5
      },
      {
        "position": 2,
        "title": "Benefit: guided workflows",
        "timestamp_start": 12.5,
        "timestamp_end": 28.0
      },
      {
        "position": 3,
        "title": "CTA: book a demo",
        "timestamp_start": 28.0,
        "timestamp_end": 42.0
      }
    ]
  }
}
```

> 注意：此接口不返回 `selector`、`value` 等内部字段，只返回展示所需数据。

---

## 七、订阅接口

### 7.1 获取当前套餐与额度
```
GET /api/subscription
Auth: 必须
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "plan": "starter",
    "status": "active",
    "demos_used_this_month": 3,
    "demos_limit": 10,
    "current_period_end": "2026-03-19T00:00:00Z"
  }
}
```

---

### 7.2 创建付费结账链接
```
POST /api/subscription/checkout
Auth: 必须
```

**Request**
```json
{
  "plan": "starter" | "pro"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "checkout_url": "https://showrunner.lemonsqueezy.com/checkout/..."
  }
}
```

> 前端拿到 `checkout_url` 后用 LemonSqueezy 内嵌 JS 弹出 Checkout 弹窗，不跳转页面。

---

## 八、Webhook 接口

### 8.1 LemonSqueezy 支付回调
```
POST /api/webhooks/lemonsqueezy
Auth: LemonSqueezy Webhook 签名验证
```

**监听事件**

| 事件 | 处理逻辑 |
|------|----------|
| `subscription_created` | 更新 plan、demos_limit |
| `subscription_updated` | 更新 plan、status |
| `subscription_cancelled` | status = cancelled |
| `subscription_expired` | status = expired，plan 降回 free |

---

## 九、接口依赖关系

```
用户注册（自管 Auth）
    ↓
创建 Demo  POST /api/demos
    ↓
[Worker 异步抓取官网、截图并生成场景]
    ↓
编辑场景  PUT /api/demos/[id]/steps
    ↓
确认生成  POST /api/demos/[id]/start
    ↓
[Worker 异步 TTS + HyperFrames 合成]
    ↓
  成功
  GET /api/share/[token]
```

---

## 十、待定事项

- [ ] 接口限流策略（未登录用户 IP 限流）
- [ ] `GET /api/demos` 是否需要搜索 / 过滤功能
- [ ] 分享页是否需要密码保护（Phase 2 功能）
- [ ] Worker 直写 MySQL 的权限隔离（最小权限账号管理）
