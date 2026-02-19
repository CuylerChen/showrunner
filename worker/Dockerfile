FROM node:20-slim

# ── 系统依赖 ──────────────────────────────────────────
# Playwright Chromium + FFmpeg + libvips（Kokoro TTS 需要）
RUN apt-get update && apt-get install -y \
    ffmpeg \
    # libvips for kokoro-js/sharp
    libvips-dev \
    # Playwright / Chromium headless 依赖
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
RUN npm ci --omit=dev

# ── 复制源码 ──────────────────────────────────────────
COPY . .

# ── 启动 ─────────────────────────────────────────────
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
