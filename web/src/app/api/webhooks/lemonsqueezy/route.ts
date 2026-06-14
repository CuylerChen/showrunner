// Legacy LemonSqueezy webhook is disabled. Paddle webhooks use /api/webhooks/paddle.
export async function POST() {
  return new Response('Not found', { status: 404 })
}
