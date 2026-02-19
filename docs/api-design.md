# Showrunner — API 接口设计
> 版本：v0.1 | 更新时间：2026-02-19
> 框架：Next.js API Routes | 认证：Clerk JWT

---

## 一、设计原则

- **RESTful 风格**，资源路径清晰
- **统一响应格式**，成功/失败结构一致
- **职责解耦**，Worker 直写 Supabase，不经过 Next.js API
- **Webhook 独立分组**，与业务接口隔离
- **公开接口**（分享页）无需鉴权，其余全部需要 Clerk JWT

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
  /webhooks           第三方回调（Clerk / LemonSqueezy）
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
  "description": "用户注册 → 创建项目 → 导出报告"  // 可选
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
3. 入队 `parse-queue`，Worker 异步解析步骤
4. 返回 `demo_id`，前端通过 Realtime 监听后续状态

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
    "description": "用户注册 → 创建项目 → 导出报告",
    "status": "review",
    "video_url": null,
    "duration": null,
    "share_token": "abc123",
    "error_message": null,
    "steps": [
      {
        "id": "uuid",
        "position": 1,
        "title": "打开注册页面",
        "action_type": "navigate",
        "selector": null,
        "value": "https://app.example.com/signup",
        "narration": "First, navigate to the signup page.",
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

### 4.5 确认步骤，开始录制
```
POST /api/demos/[id]/start
Auth: 必须
```

> 用户在步骤卡片页面确认后调用此接口，触发录制。

**Request**：无 body

**Response 200**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "recording" }
}
```

**逻辑**
1. 校验 `demo.status === 'review'`，否则返回 `DEMO_NOT_READY`
2. 更新 status = `recording`
3. 入队 `record-queue`

---

### 4.6 录制失败后用户介入
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

**逻辑**：删除 Supabase Storage 视频文件 + 数据库记录

---

## 五、步骤接口

### 5.1 批量更新步骤（编辑 + 排序）
```
PUT /api/demos/[id]/steps
Auth: 必须
```

> 用户在步骤卡片页拖拽排序或修改文字后，整体提交。

**Request**
```json
{
  "steps": [
    {
      "id": "uuid",
      "position": 1,
      "title": "打开注册页面",
      "narration": "First, navigate to the signup page."
    },
    {
      "id": "uuid",
      "position": 2,
      "title": "填写邮箱和密码",
      "narration": "Enter your email and password."
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
    "video_url": "https://storage.supabase.co/videos/xxx/final.mp4",
    "duration": 42,
    "steps": [
      {
        "position": 1,
        "title": "注册账号",
        "timestamp_start": 0,
        "timestamp_end": 12.5
      },
      {
        "position": 2,
        "title": "创建项目",
        "timestamp_start": 12.5,
        "timestamp_end": 28.0
      },
      {
        "position": 3,
        "title": "导出报告",
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

### 8.1 Clerk 用户同步
```
POST /api/webhooks/clerk
Auth: Clerk Webhook 签名验证
```

**监听事件**
- `user.created` → 在 `users` 表插入记录，同时创建 `subscriptions`（plan=free）
- `user.updated` → 更新 `users.email`
- `user.deleted` → 删除用户及关联数据

---

### 8.2 LemonSqueezy 支付回调
```
POST /api/webhooks/lemonsqueezy
Auth: LemonSqueezy Webhook 签名验证
```

**监听事件**

| 事件 | 处理逻辑 |
|------|----------|
| `subscription_created` | 更新 plan、demos_limit、lemon_squeezy_id |
| `subscription_updated` | 更新 plan、status |
| `subscription_cancelled` | status = cancelled |
| `subscription_expired` | status = expired，plan 降回 free |

---

## 九、接口依赖关系

```
用户注册（Clerk Webhook）
    ↓
创建 Demo  POST /api/demos
    ↓
[Worker 异步解析步骤，Realtime 推送]
    ↓
编辑步骤  PUT /api/demos/[id]/steps
    ↓
确认录制  POST /api/demos/[id]/start
    ↓
[Worker 异步录制，Realtime 推送]
    ↓                ↓
  成功            录制失败
  访问分享页       POST /api/demos/[id]/steps/[stepId]/resolve
  GET /api/share/[token]
```

---

## 十、待定事项

- [ ] 接口限流策略（未登录用户 IP 限流）
- [ ] `GET /api/demos` 是否需要搜索 / 过滤功能
- [ ] 分享页是否需要密码保护（Phase 2 功能）
- [ ] Worker 直写 Supabase 的权限隔离（service role key 管理）
