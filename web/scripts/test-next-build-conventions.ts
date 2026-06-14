import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..')
const srcDir = path.join(projectRoot, 'src')

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return walkFiles(fullPath)
    return entry.isFile() ? [fullPath] : []
  })
}

const sourceFiles = walkFiles(srcDir).filter(file => /\.(ts|tsx|js|jsx)$/.test(file))
const googleFontImports = sourceFiles.filter(file => fs.readFileSync(file, 'utf8').includes('next/font/google'))

assert.deepEqual(
  googleFontImports.map(file => path.relative(projectRoot, file)),
  [],
  'production builds must not depend on build-time Google Fonts fetches',
)

const middlewarePath = path.join(srcDir, 'middleware.ts')
const proxyPath = path.join(srcDir, 'proxy.ts')

assert.equal(fs.existsSync(middlewarePath), false, 'Next 16 should use src/proxy.ts instead of deprecated src/middleware.ts')
assert.equal(fs.existsSync(proxyPath), true, 'src/proxy.ts should provide the request proxy')

const proxySource = fs.readFileSync(proxyPath, 'utf8')
assert.match(proxySource, /export\s+async\s+function\s+proxy\(/, 'src/proxy.ts should export async function proxy')
assert.match(proxySource, /export\s+const\s+config\s*=/, 'src/proxy.ts should export matcher config')

console.log('next build convention tests passed')
