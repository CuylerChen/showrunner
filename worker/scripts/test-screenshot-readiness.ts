import assert from 'node:assert/strict'
import {
  preparePageForScreenshot,
  shouldRetrySparseScreenshot,
} from '../src/services/parser/assets'

const calls: string[] = []

const fakePage = {
  waitForLoadState: async (state: string) => {
    calls.push(`load:${state}`)
  },
  waitForFunction: async (_fn: () => boolean, _arg?: unknown, options?: { timeout?: number }) => {
    calls.push(`function:${options?.timeout ?? 0}`)
  },
  evaluate: async (_fn: () => unknown) => {
    calls.push('evaluate')
  },
  waitForTimeout: async (timeout: number) => {
    calls.push(`timeout:${timeout}`)
  },
}

async function main() {
  await preparePageForScreenshot(fakePage)

  assert.deepEqual(calls, [
    'load:domcontentloaded',
    'load:networkidle',
    'function:8000',
    'function:4000',
    'evaluate',
    'timeout:300',
  ])

  assert.equal(shouldRetrySparseScreenshot({ textLength: 20, imageCount: 0 }), true)
  assert.equal(shouldRetrySparseScreenshot({ textLength: 240, imageCount: 0 }), false)
  assert.equal(shouldRetrySparseScreenshot({ textLength: 40, imageCount: 2 }), false)
}

main().then(() => {
  console.log('screenshot readiness tests passed')
})
