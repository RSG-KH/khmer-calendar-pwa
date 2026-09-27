import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { dateTimeInZone } = await server.ssrLoadModule('/src/domain/DateTime.ts');
const { geonamesDivisions } = await server.ssrLoadModule('/src/data/GeoNamesDivisions.ts');

test('year browsing retains only twelve recent years and recomputes evicted years identically', () => {
  EventRepository.clearCache();
  const oldest = EventRepository.getYearEvents(2000);
  const recent = EventRepository.getYearEvents(2001);
  for (let year = 2002; year <= 2011; year++) EventRepository.getYearEvents(year);
  assert.strictEqual(EventRepository.getYearEvents(2001), recent);
  EventRepository.getYearEvents(2012);
  assert.strictEqual(EventRepository.getYearEvents(2001), recent, 'a cache hit refreshes recency');
  const rebuilt = EventRepository.getYearEvents(2000);
  assert.notStrictEqual(rebuilt, oldest, 'the least recently used year is released');
  assert.deepEqual(rebuilt, oldest);
  EventRepository.clearCache();
});

test('timezone formatter cache reuses hot zones and releases older zones', () => {
  const original = Intl.DateTimeFormat;
  let created = 0;
  Intl.DateTimeFormat = class extends original { constructor(...args) { super(...args); created++; } };
  try {
    const zones = Intl.supportedValuesOf('timeZone').slice(0, 40);
    const at = new Date('2026-09-27T12:00:00Z');
    const expected = dateTimeInZone(at, zones[0]);
    const warm = created;
    assert.deepEqual(dateTimeInZone(at, zones[0]), expected);
    assert.equal(created, warm);
    for (const zone of zones.slice(1)) dateTimeInZone(at, zone);
    const afterSweep = created;
    dateTimeInZone(at, zones.at(-1));
    assert.equal(created, afterSweep);
    assert.deepEqual(dateTimeInZone(at, zones[0]), expected);
    assert.equal(created, afterSweep + 1, 'older formatter was evicted');
  } finally { Intl.DateTimeFormat = original; }
});

test('an evicted failing country request cannot remove its newer replacement', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = url => new Promise((resolve, reject) => requests.push({ url, resolve, reject }));
  try {
    const first = geonamesDivisions('US');
    const failed = assert.rejects(first, /offline/);
    const france = geonamesDivisions('FR');
    const belgium = geonamesDivisions('BE');
    const replacement = geonamesDivisions('US');
    assert.notStrictEqual(first, replacement);
    requests[0].reject(new Error('offline'));
    await failed;
    assert.strictEqual(geonamesDivisions('US'), replacement);
    assert.equal(requests.length, 4, 'reuse the pending replacement without another download');
    for (const request of requests.slice(1)) {
      request.resolve(new Response(JSON.stringify({ schemaVersion: 3, countryCode: request.url.match(/([A-Z]{2})\.json/)[1], datasetVersion: '0'.repeat(64), divisions: [] })));
    }
    await Promise.all([france, belgium, replacement]);
  } finally { globalThis.fetch = original; }
});
