// Legacy LemonSqueezy webhook is disabled. Creem webhooks use /api/webhooks/creem.
export async function POST() {
  return new Response('Not found', { status: 404 })
}
