FROM node:20-slim

# ── 系统依赖 ──────────────────────────────────────────
# Playwright Chromium + FFmpeg + libvips（Kokoro TTS 需要）
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libvips-dev \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# 告知 Playwright 使用系统 Chromium，跳过内置下载
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# ── 安装依赖 ──────────────────────────────────────────
COPY package*.json ./
RUN npm ci

# ── 复制源码 ──────────────────────────────────────────
COPY . .

# 创建视频持久化目录
RUN mkdir -p /data/videos

# ── 启动 ─────────────────────────────────────────────
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
