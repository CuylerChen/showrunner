# Showrunner 部署指南

> 当前架构：MySQL、自管 JWT 认证、Redis 队列、OpenAI-compatible Chat Completions、Kokoro TTS（可选独立 OpenAI TTS）、HyperFrames 视频合成。

## 推荐路径

新服务器优先使用 Docker 部署：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/CuylerChen/showrunner/main/scripts/setup.sh)
```

不使用 Docker 时，参考 [裸机部署文档](./bare-metal-deploy.md)：

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
MYSQL_ROOT_PASSWORD=change_this_root_password
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=showrunner
MYSQL_PASSWORD=change_this_password
MYSQL_DATABASE=showrunner

JWT_SECRET=change_this_to_random_32_char_string
REDIS_URL=redis://redis:6379

OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

TTS_PROVIDER=kokoro
# OPENAI_TTS_API_KEY=sk-...
# OPENAI_TTS_BASE_URL=https://api.openai.com/v1
# OPENAI_TTS_MODEL=gpt-4o-mini-tts
# OPENAI_TTS_VOICE=coral
# OPENAI_TTS_SPEED=0.95

NEXT_PUBLIC_APP_URL=https://your-domain.com
VIDEO_DIR=/data/videos
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

Docker 部署会自动挂载并执行：

```text
database/schema.sql -> /docker-entrypoint-initdb.d/schema.sql
```

裸机部署可手动导入：

```bash
mysql -u showrunner -p showrunner < /opt/showrunner/database/schema.sql
```

## 验证

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f worker
```

访问 `NEXT_PUBLIC_APP_URL`，注册账号后创建 demo。Worker 日志中应能看到 parse、tts、merge 阶段执行记录。
