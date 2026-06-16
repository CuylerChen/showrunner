import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const setupBare = read('scripts/setup-bare.sh')
const deployBare = read('scripts/deploy-bare.sh')
const rootPm2 = read('ecosystem.config.cjs')
const envExample = read('.env.example')
const webEnvExample = read('web/.env.local.example')
const dockerCompose = read('docker-compose.yml')
const deploymentDoc = read('docs/deployment.md')
const bareMetalDoc = read('docs/bare-metal-deploy.md')
const vpsDoc = read('docs/vps-deploy.md')

const requiredRuntimeKeys = [
  'WORKER_INTERNAL_URL',
  'WORKER_PORT',
  'WORKER_HOST',
  'PADDLE_ENVIRONMENT',
  'PADDLE_API_KEY',
  'PADDLE_CLIENT_TOKEN',
  'PADDLE_WEBHOOK_SECRET',
  'PADDLE_STARTER_PRICE_ID',
  'PADDLE_PRO_PRICE_ID',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
]

for (const key of requiredRuntimeKeys) {
  assert.match(setupBare, new RegExp(`${key}=`), `setup-bare.sh should write ${key} into /opt/showrunner/.env`)
  assert.match(setupBare, new RegExp(`${key}:\\s*process\\.env\\.${key}`), `PM2 env should pass ${key}`)
  assert.match(envExample, new RegExp(`^${key}=`, 'm'), `.env.example should document ${key}`)
}

assert.match(setupBare, /OPENAI_BASE="https:\/\/sub\.sharellm\.uk\/v1"/, 'bare-metal setup should default to the configured OpenAI-compatible gateway')
assert.match(setupBare, /OPENAI_MODEL="gpt-5\.5"/, 'bare-metal setup should default to gpt-5.5')
assert.match(envExample, /^OPENAI_BASE_URL=https:\/\/sub\.sharellm\.uk\/v1$/m, '.env.example should use the configured OpenAI-compatible gateway')
assert.match(envExample, /^OPENAI_MODEL=gpt-5\.5$/m, '.env.example should use gpt-5.5')

assert.match(deployBare, /pm2 reload showrunner-web --update-env/, 'web deploy should refresh PM2 environment variables')
assert.match(deployBare, /pm2 restart showrunner-worker --update-env/, 'worker deploy should refresh PM2 environment variables')
assert.match(deployBare, /syncNextStandaloneAssets/, 'web deploy should sync Next standalone static assets')
assert.match(deployBare, /mkdir -p "\.next\/standalone\/\.next"/, 'web deploy should create standalone .next directory before syncing static assets')
assert.match(deployBare, /cp -R "\.next\/static" "\.next\/standalone\/\.next\/static"/, 'web deploy should copy .next/static into standalone output')
assert.match(deployBare, /cp -R "public" "\.next\/standalone\/public"/, 'web deploy should copy public assets into standalone output')

assert.doesNotMatch(rootPm2, /\/root\/\.openclaw\/workspace\/showrunner/, 'root PM2 config must not contain stale local workspace paths')
assert.doesNotMatch(rootPm2, /require\('dotenv'\)/, 'root PM2 config should not depend on root-level dotenv')
assert.doesNotMatch(setupBare, /require\('dotenv'\)/, 'generated PM2 config should not depend on root-level dotenv')
assert.match(rootPm2, /function loadEnvFile/, 'root PM2 config should load .env without external dependencies')
assert.match(setupBare, /function loadEnvFile/, 'generated PM2 config should load .env without external dependencies')
assert.match(rootPm2, /cwd:\s*'\/opt\/showrunner\/web'/, 'root PM2 config should target /opt/showrunner/web')
assert.match(rootPm2, /WORKER_INTERNAL_URL:\s*process\.env\.WORKER_INTERNAL_URL/, 'root PM2 config should pass WORKER_INTERNAL_URL')
assert.match(rootPm2, /WORKER_PORT:\s*process\.env\.WORKER_PORT/, 'root PM2 config should pass WORKER_PORT')
assert.match(rootPm2, /WORKER_HOST:\s*process\.env\.WORKER_HOST/, 'root PM2 config should pass WORKER_HOST')
assert.match(rootPm2, /PADDLE_API_KEY:\s*process\.env\.PADDLE_API_KEY/, 'root PM2 config should pass Paddle settings')
assert.match(rootPm2, /PADDLE_CLIENT_TOKEN:\s*process\.env\.PADDLE_CLIENT_TOKEN/, 'root PM2 config should pass Paddle client token')
assert.match(rootPm2, /PADDLE_STARTER_PRICE_ID:\s*process\.env\.PADDLE_STARTER_PRICE_ID/, 'root PM2 config should pass Starter Paddle price id')
assert.match(rootPm2, /PADDLE_PRO_PRICE_ID:\s*process\.env\.PADDLE_PRO_PRICE_ID/, 'root PM2 config should pass Pro Paddle price id')
assert.match(dockerCompose, /PADDLE_CLIENT_TOKEN:\s*\$\{PADDLE_CLIENT_TOKEN:-\}/, 'docker-compose web service should pass Paddle client token')
assert.match(dockerCompose, /PADDLE_STARTER_PRICE_ID:\s*\$\{PADDLE_STARTER_PRICE_ID:-\}/, 'docker-compose web service should pass Starter Paddle price id')
assert.match(dockerCompose, /PADDLE_PRO_PRICE_ID:\s*\$\{PADDLE_PRO_PRICE_ID:-\}/, 'docker-compose web service should pass Pro Paddle price id')

assert.match(setupBare, /syncNextStandaloneAssets/, 'bare-metal setup should sync Next standalone static assets')
assert.match(setupBare, /mkdir -p "\.next\/standalone\/\.next"/, 'bare-metal setup should create standalone .next directory before syncing static assets')
assert.match(setupBare, /cp -R "\.next\/static" "\.next\/standalone\/\.next\/static"/, 'bare-metal setup should copy .next/static into standalone output')
assert.match(setupBare, /cp -R "public" "\.next\/standalone\/public"/, 'bare-metal setup should copy public assets into standalone output')

assert.doesNotMatch(webEnvExample, /CLERK_|SUPABASE_|LEMONSQUEEZY_|OPENROUTER_/i, 'web env example should not document removed providers')
assert.match(webEnvExample, /^MYSQL_HOST=127\.0\.0\.1$/m, 'web env example should document current MySQL config')
assert.match(webEnvExample, /^PADDLE_ENVIRONMENT=production$/m, 'web env example should document Paddle production config')
assert.match(webEnvExample, /^PADDLE_CLIENT_TOKEN=$/m, 'web env example should document Paddle client token')
assert.match(webEnvExample, /^PADDLE_STARTER_PRICE_ID=$/m, 'web env example should document Starter Paddle price id')
assert.match(webEnvExample, /^PADDLE_PRO_PRICE_ID=$/m, 'web env example should document Pro Paddle price id')
assert.match(webEnvExample, /^WORKER_INTERNAL_URL=http:\/\/127\.0\.0\.1:3001$/m, 'web env example should document bare-metal worker URL')
assert.match(envExample, /^WORKER_PORT=3001$/m, '.env.example should document worker HTTP port')
assert.match(envExample, /^WORKER_HOST=127\.0\.0\.1$/m, '.env.example should document worker HTTP host')

assert.match(deploymentDoc, /推荐路径[\s\S]*setup-bare\.sh/, 'deployment guide should lead with bare-metal deployment')
assert.doesNotMatch(deploymentDoc, /新服务器优先使用 Docker 部署/, 'deployment guide should not recommend Docker first')
assert.doesNotMatch(deploymentDoc, /docker compose|docker-entrypoint-initdb/i, 'deployment guide should not use Docker verification or init commands')
assert.match(deploymentDoc, /pm2 status/, 'deployment guide should verify PM2 services')
assert.match(bareMetalDoc, /WORKER_INTERNAL_URL=http:\/\/127\.0\.0\.1:3001/, 'bare-metal docs should include WORKER_INTERNAL_URL')
assert.match(bareMetalDoc, /PADDLE_ENVIRONMENT=production/, 'bare-metal docs should include Paddle production settings')
assert.match(vpsDoc, /PADDLE_STARTER_PRICE_ID=/, 'VPS docs should include Starter Paddle price id')
assert.match(vpsDoc, /PADDLE_PRO_PRICE_ID=/, 'VPS docs should include Pro Paddle price id')

console.log('bare-metal deployment config tests passed')
