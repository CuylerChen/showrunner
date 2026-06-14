import assert from 'node:assert/strict'
import { inferProductCategory } from '../src/services/parser'

assert.equal(inferProductCategory({
  productUrl: 'https://shop.example',
  description: 'Buy ceramic mugs from a product catalog with cart checkout, shipping, and discounts.',
  sourceSummary: '',
}), 'ecommerce')

assert.equal(inferProductCategory({
  productUrl: 'https://api.example.dev',
  description: 'Developer API with SDK docs, webhook events, endpoints, and API keys.',
  sourceSummary: '',
}), 'developer_tool')

assert.equal(inferProductCategory({
  productUrl: 'https://clinic.example',
  description: 'Local dental clinic with appointment booking, service area, and consultations.',
  sourceSummary: '',
}), 'local_service')

assert.equal(inferProductCategory({
  productUrl: 'https://learn.example',
  description: 'Newsletter articles, courses, episodes, and creator membership content.',
  sourceSummary: '',
}), 'content')

assert.equal(inferProductCategory({
  productUrl: 'https://crm.example',
  description: 'Team dashboard for workflow automation, analytics, collaboration, and CRM tasks.',
  sourceSummary: '',
}), 'saas')

assert.equal(inferProductCategory({
  productUrl: 'https://example.com',
  description: 'A simple product page.',
  sourceSummary: '',
}), 'generic')

console.log('product category inference tests passed')
