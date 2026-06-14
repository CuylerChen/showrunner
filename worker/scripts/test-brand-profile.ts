import assert from 'node:assert/strict'
import { extractBrandProfileFromHtml } from '../src/services/parser'

const html = `
<!doctype html>
<html>
<head>
  <title>Acme Coffee | Office beans delivered weekly</title>
  <meta property="og:site_name" content="Acme Coffee">
  <meta name="theme-color" content="#7C3A12">
  <meta name="description" content="Fresh office coffee subscriptions.">
</head>
<body>
  <h1>Fresh beans delivered weekly</h1>
</body>
</html>
`

const profile = extractBrandProfileFromHtml(html, 'https://coffee.example')

assert.equal(profile.name, 'Acme Coffee')
assert.equal(profile.primaryColor, '#7C3A12')
assert.deepEqual(profile.colors, ['#7C3A12'])

const fallback = extractBrandProfileFromHtml('<title>TaskFlow - Project planning for small teams</title>', 'https://www.taskflow.example')

assert.equal(fallback.name, 'TaskFlow')
assert.equal(fallback.primaryColor, null)
assert.deepEqual(fallback.colors, [])

console.log('brand profile extraction tests passed')
