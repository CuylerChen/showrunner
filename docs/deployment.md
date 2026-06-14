# Showrunner 部署指南

> 当前架构：MySQL、自管 JWT 认证、Redis 队列、OpenAI-compatible Chat Completions、Kokoro TTS（可选独立 OpenAI TTS）、HyperFrames 视频合成。

## 推荐路径

新服务器使用裸机部署，不使用 Docker。参考 [裸机部署文档](./bare-metal-deploy.md)：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/CuylerChen/showrunner/main/scripts/setup-bare.sh)
```

## 核心服务

```text
Nginx
  -> Web (Next.js API + pages)
  -> Worker internal API

Web
  -> MySQL
  -> Redis / BullMQ
  -> Worker

Worker
  -> MySQL
  -> Redis / BullMQ
  -> OpenAI-compatible Chat Completions
  -> Kokoro TTS, or optional OpenAI TTS via OPENAI_TTS_*
  -> local video storage or Cloudflare R2
```

## 环境变量

项目根目录 `.env`：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=showrunner
MYSQL_PASSWORD=change_this_password
MYSQL_DATABASE=showrunner

JWT_SECRET=change_this_to_random_32_char_string
REDIS_URL=redis://127.0.0.1:6379

OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://sub.sharellm.uk/v1
OPENAI_MODEL=gpt-5.5

TTS_PROVIDER=kokoro
# OPENAI_TTS_API_KEY=sk-...
# OPENAI_TTS_BASE_URL=https://api.openai.com/v1
# OPENAI_TTS_MODEL=gpt-4o-mini-tts
# OPENAI_TTS_VOICE=coral
# OPENAI_TTS_SPEED=0.95

NEXT_PUBLIC_APP_URL=https://your-domain.com
WORKER_INTERNAL_URL=http://127.0.0.1:3001

PADDLE_ENVIRONMENT=production
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_STARTER_PRICE_ID=
PADDLE_PRO_PRICE_ID=

VIDEO_DIR=/opt/showrunner/videos
```

可选视频对象存储：

```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=showrunner-videos
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

可选 OAuth 登录：

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## 数据库初始化

`setup-bare.sh` 会自动创建数据库并导入结构。手动部署时可执行：

```bash
mysql -u showrunner -p showrunner < /opt/showrunner/database/schema.sql
```

## 验证

```bash
systemctl status mysql
systemctl status redis-server
systemctl status nginx
pm2 status
pm2 logs showrunner-web --lines 30
pm2 logs showrunner-worker --lines 30
```

访问 `NEXT_PUBLIC_APP_URL`，注册账号后创建 demo。Worker 日志中应能看到 parse、tts、merge 阶段执行记录。
