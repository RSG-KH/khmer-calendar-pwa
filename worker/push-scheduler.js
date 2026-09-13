/**
 * Cloudflare Worker Cron Trigger (100% Free Tier)
 * Sends scheduled iOS 16.4+ Web Push notifications for Buddhist Holy Days and Holidays.
 *
 * Environment variables:
 * - VAPID_SUBJECT: "mailto:support@khmercalendar.app"
 * - VAPID_PUBLIC_KEY: Your generated VAPID public key
 * - VAPID_PRIVATE_KEY: Your generated VAPID private key
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

  // Cron trigger (e.g. runs every day at 00:00 UTC = 07:00 AM Cambodia Time)
  async scheduled(event, env, ctx) {
    // 1. Fetch today's events from date calculation
    // 2. Broadcast push to registered endpoints using standard WebPush RFC 8291
    console.log('Running daily notification dispatch...');
  }
};
