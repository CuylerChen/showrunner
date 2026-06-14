import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const apiSource = fs.readFileSync(path.join(ROOT, 'src/lib/api.ts'), 'utf8')
const appDir = path.join(ROOT, 'src/app')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) return []
    return [fullPath]
  })
}

function extractErrorCodes(): Set<string> {
  const unionMatch = apiSource.match(/type ErrorCode =([\s\S]*?)\n\nconst STATUS_MAP/)
  if (!unionMatch) throw new Error('Could not find ErrorCode union in src/lib/api.ts')
  const codes = [...unionMatch[1].matchAll(/\|\s+'([^']+)'/g)].map(match => match[1])
  return new Set(codes)
}

const declaredCodes = extractErrorCodes()
const usedCodes = new Set<string>()

for (const file of walk(appDir)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/\berr\(\s*'([^']+)'/g)) {
    usedCodes.add(match[1])
  }
}

const missingCodes = [...usedCodes].filter(code => !declaredCodes.has(code)).sort()

if (missingCodes.length > 0) {
  throw new Error(`Missing API error code declarations: ${missingCodes.join(', ')}`)
}

console.log('api error code tests passed')
