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
  'CREEM_API_KEY',
  'CREEM_API_BASE_URL',
  'CREEM_MODERATION_TIMEOUT_MS',
  'CREEM_WEBHOOK_SECRET',
  'CREEM_STARTER_PRODUCT_ID',
  'CREEM_PRO_PRODUCT_ID',
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

assert.match(deployBare, /SSH_HOST="\$\{SSH_HOST:-contabo-gigacoder\}"/, 'bare deploy should default to the reachable production SSH alias')
assert.match(deployBare, /REMOTE_DIR="\$\{REMOTE_DIR:-\/opt\/showrunner\/app\}"/, 'bare deploy should default to the production app checkout')
assert.match(deployBare, /REMOTE_USER="\$\{REMOTE_USER:-showrunner\}"/, 'bare deploy should run build commands as the app user')
assert.match(deployBare, /systemctl restart "\$WEB_SERVICE"/, 'web deploy should restart the systemd web service')
assert.match(deployBare, /systemctl restart "\$WORKER_SERVICE"/, 'worker deploy should restart the systemd worker service')
assert.match(deployBare, /systemctl is-active "\$WEB_SERVICE"/, 'web deploy should verify the systemd web service')
assert.match(deployBare, /systemctl is-active "\$WORKER_SERVICE"/, 'worker deploy should verify the systemd worker service')
assert.match(deployBare, /journalctl -u \$\{WEB_SERVICE\}/, 'web deploy should print journalctl log commands')
assert.match(deployBare, /run_as_app_user/, 'bare deploy should execute app commands as the configured app user')
assert.match(deployBare, /runMigrations/, 'bare deploy should run database migrations')
assert.match(deployBare, /database\/migrations\/\*\.sql/, 'bare deploy should apply SQL migration files')
assert.match(deployBare, /npm ci --include=dev --quiet/, 'bare deploy should install build-time dev dependencies')
assert.match(deployBare, /syncNextStandaloneAssets/, 'web deploy should sync Next standalone static assets')
assert.match(deployBare, /run_as_app_user mkdir -p "\.next\/standalone\/\.next"/, 'web deploy should create standalone .next directory as the app user')
assert.match(deployBare, /run_as_app_user cp -R "\.next\/static" "\.next\/standalone\/\.next\/static"/, 'web deploy should copy .next/static into standalone output as the app user')
assert.match(deployBare, /run_as_app_user cp -R "public" "\.next\/standalone\/public"/, 'web deploy should copy public assets into standalone output as the app user')

assert.doesNotMatch(rootPm2, /\/root\/\.openclaw\/workspace\/showrunner/, 'root PM2 config must not contain stale local workspace paths')
assert.doesNotMatch(rootPm2, /require\('dotenv'\)/, 'root PM2 config should not depend on root-level dotenv')
assert.doesNotMatch(setupBare, /require\('dotenv'\)/, 'generated PM2 config should not depend on root-level dotenv')
assert.match(rootPm2, /function loadEnvFile/, 'root PM2 config should load .env without external dependencies')
assert.match(setupBare, /function loadEnvFile/, 'generated PM2 config should load .env without external dependencies')
assert.match(rootPm2, /cwd:\s*'\/opt\/showrunner\/web'/, 'root PM2 config should target /opt/showrunner/web')
assert.match(rootPm2, /WORKER_INTERNAL_URL:\s*process\.env\.WORKER_INTERNAL_URL/, 'root PM2 config should pass WORKER_INTERNAL_URL')
assert.match(rootPm2, /WORKER_PORT:\s*process\.env\.WORKER_PORT/, 'root PM2 config should pass WORKER_PORT')
assert.match(rootPm2, /WORKER_HOST:\s*process\.env\.WORKER_HOST/, 'root PM2 config should pass WORKER_HOST')
assert.match(rootPm2, /CREEM_API_KEY:\s*process\.env\.CREEM_API_KEY/, 'root PM2 config should pass Creem API key')
assert.match(rootPm2, /CREEM_WEBHOOK_SECRET:\s*process\.env\.CREEM_WEBHOOK_SECRET/, 'root PM2 config should pass Creem webhook secret')
assert.match(rootPm2, /CREEM_STARTER_PRODUCT_ID:\s*process\.env\.CREEM_STARTER_PRODUCT_ID/, 'root PM2 config should pass Starter Creem product id')
assert.match(rootPm2, /CREEM_PRO_PRODUCT_ID:\s*process\.env\.CREEM_PRO_PRODUCT_ID/, 'root PM2 config should pass Pro Creem product id')
assert.match(dockerCompose, /CREEM_API_KEY:\s*\$\{CREEM_API_KEY:-\}/, 'docker-compose web service should pass Creem API key')
assert.match(dockerCompose, /CREEM_STARTER_PRODUCT_ID:\s*\$\{CREEM_STARTER_PRODUCT_ID:-\}/, 'docker-compose web service should pass Starter Creem product id')
assert.match(dockerCompose, /CREEM_PRO_PRODUCT_ID:\s*\$\{CREEM_PRO_PRODUCT_ID:-\}/, 'docker-compose web service should pass Pro Creem product id')

assert.match(setupBare, /syncNextStandaloneAssets/, 'bare-metal setup should sync Next standalone static assets')
assert.match(setupBare, /mkdir -p "\.next\/standalone\/\.next"/, 'bare-metal setup should create standalone .next directory before syncing static assets')
assert.match(setupBare, /cp -R "\.next\/static" "\.next\/standalone\/\.next\/static"/, 'bare-metal setup should copy .next/static into standalone output')
assert.match(setupBare, /cp -R "public" "\.next\/standalone\/public"/, 'bare-metal setup should copy public assets into standalone output')

assert.doesNotMatch(webEnvExample, /CLERK_|SUPABASE_|LEMONSQUEEZY_|OPENROUTER_/i, 'web env example should not document removed providers')
assert.match(webEnvExample, /^MYSQL_HOST=127\.0\.0\.1$/m, 'web env example should document current MySQL config')
assert.match(webEnvExample, /^CREEM_API_BASE_URL=https:\/\/api\.creem\.io$/m, 'web env example should document Creem production API base URL')
assert.match(webEnvExample, /^CREEM_WEBHOOK_SECRET=$/m, 'web env example should document Creem webhook secret')
assert.match(webEnvExample, /^CREEM_STARTER_PRODUCT_ID=$/m, 'web env example should document Starter Creem product id')
assert.match(webEnvExample, /^CREEM_PRO_PRODUCT_ID=$/m, 'web env example should document Pro Creem product id')
assert.match(webEnvExample, /^WORKER_INTERNAL_URL=http:\/\/127\.0\.0\.1:3001$/m, 'web env example should document bare-metal worker URL')
assert.match(envExample, /^WORKER_PORT=3001$/m, '.env.example should document worker HTTP port')
assert.match(envExample, /^WORKER_HOST=127\.0\.0\.1$/m, '.env.example should document worker HTTP host')

assert.match(deploymentDoc, /推荐路径[\s\S]*setup-bare\.sh/, 'deployment guide should lead with bare-metal deployment')
assert.doesNotMatch(deploymentDoc, /新服务器优先使用 Docker 部署/, 'deployment guide should not recommend Docker first')
assert.doesNotMatch(deploymentDoc, /docker compose|docker-entrypoint-initdb/i, 'deployment guide should not use Docker verification or init commands')
assert.match(deploymentDoc, /systemctl status showrunner-web\.service showrunner-worker\.service/, 'deployment guide should verify systemd app services')
assert.match(deploymentDoc, /journalctl -u showrunner-web\.service/, 'deployment guide should use journalctl for web logs')
assert.match(deploymentDoc, /journalctl -u showrunner-worker\.service/, 'deployment guide should use journalctl for worker logs')
assert.match(bareMetalDoc, /WORKER_INTERNAL_URL=http:\/\/127\.0\.0\.1:3001/, 'bare-metal docs should include WORKER_INTERNAL_URL')
assert.match(bareMetalDoc, /CREEM_API_BASE_URL=https:\/\/api\.creem\.io/, 'bare-metal docs should include Creem production settings')
assert.match(vpsDoc, /CREEM_STARTER_PRODUCT_ID=/, 'VPS docs should include Starter Creem product id')
assert.match(vpsDoc, /CREEM_PRO_PRODUCT_ID=/, 'VPS docs should include Pro Creem product id')

console.log('bare-metal deployment config tests passed')
