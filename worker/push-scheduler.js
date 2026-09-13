/**
 * Unused Cloudflare Worker prototype; not deployed by the GitHub Pages workflow.
 * The PWA does not connect to this endpoint or schedule reminders.
 *
 * The registration sketch uses an optional SUBSCRIPTIONS KV binding.
 * Event selection, VAPID signing and Web Push delivery are not implemented.
 */

export default {
  // HTTP endpoint to register device subscriptions
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/subscribe') {
      const sub = await request.json();
      // Store in Cloudflare KV or D1 (anonymous token)
      if (env.SUBSCRIPTIONS && sub && sub.endpoint) {
        await env.SUBSCRIPTIONS.put(sub.endpoint, JSON.stringify(sub));
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('No KV store bound', { status: 200 });
    }
    return new Response('Khmer Calendar Push Scheduler Active', { status: 200 });
  },

  // Placeholder only; no Cron Trigger is configured in this repository.
  async scheduled(event, env, ctx) {
    // 1. Fetch today's events from date calculation
    // 2. Broadcast push to registered endpoints using standard WebPush RFC 8291
    console.log('Running daily notification dispatch...');
  }
};
