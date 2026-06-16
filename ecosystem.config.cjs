const path = require('path')
const fs = require('fs')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'))

const env = {
  NODE_ENV: 'production',
  MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
  MYSQL_PORT: process.env.MYSQL_PORT || '3306',
  MYSQL_USER: process.env.MYSQL_USER,
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'showrunner',
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://sub.sharellm.uk/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.5',
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'kokoro',
  OPENAI_TTS_API_KEY: process.env.OPENAI_TTS_API_KEY,
  OPENAI_TTS_BASE_URL: process.env.OPENAI_TTS_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE || 'coral',
  OPENAI_TTS_SPEED: process.env.OPENAI_TTS_SPEED || '0.95',
  OPENAI_TTS_INSTRUCTIONS: process.env.OPENAI_TTS_INSTRUCTIONS,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  WORKER_INTERNAL_URL: process.env.WORKER_INTERNAL_URL || 'http://127.0.0.1:3001',
  WORKER_PORT: process.env.WORKER_PORT || '3001',
  WORKER_HOST: process.env.WORKER_HOST || '127.0.0.1',
  PADDLE_ENVIRONMENT: process.env.PADDLE_ENVIRONMENT || 'production',
  PADDLE_API_KEY: process.env.PADDLE_API_KEY,
  PADDLE_CLIENT_TOKEN: process.env.PADDLE_CLIENT_TOKEN,
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  PADDLE_STARTER_PRICE_ID: process.env.PADDLE_STARTER_PRICE_ID,
  PADDLE_PRO_PRICE_ID: process.env.PADDLE_PRO_PRICE_ID,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  VIDEO_DIR: process.env.VIDEO_DIR || '/opt/showrunner/videos',
}

module.exports = {
  apps: [
    {
      name: 'showrunner-web',
      cwd: '/opt/showrunner/web',
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...env,
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
      error_file: '/var/log/showrunner/web-error.log',
      out_file: '/var/log/showrunner/web-out.log',
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'showrunner-worker',
      cwd: '/opt/showrunner/worker',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
      },
      error_file: '/var/log/showrunner/worker-error.log',
      out_file: '/var/log/showrunner/worker-out.log',
      merge_logs: true,
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
}
