import assert from 'node:assert/strict';
import { test, after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
beforeEach(() => values.clear());
const settingsKey = 'khmer_calendar_settings';
const eventsKey = 'khmer_calendar_custom_events';
const good = { id: 'good', title: 'Family event', date: '2026-09-27' };

test('malformed preferences use safe defaults while preserving valid choices and legacy migration', () => {
  values.set(settingsKey, JSON.stringify({ todayTimeZone: 'Not/AZone', fontScale: 'huge', language: 'en',
    accent: 'rose', theme: 'invalid', showGanzhi: 'false', showObservances: false, hideWesternZodiac: true }));
  const settings = Storage.getSettings();
  assert.equal(settings.todayTimeZone, DEFAULT_SETTINGS.todayTimeZone);
  assert.equal(settings.fontScale, DEFAULT_SETTINGS.fontScale);
  assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
  assert.equal(settings.showGanzhi, DEFAULT_SETTINGS.showGanzhi);
  assert.equal(settings.language, 'en');
  assert.equal(settings.accent, 'rose');
  assert.equal(settings.showObservances, false);
  assert.equal(settings.showWesternZodiac, false);
  for (const value of [null, [], 42, 'text']) {
    values.set(settingsKey, JSON.stringify(value));
    assert.deepEqual(Storage.getSettings(), DEFAULT_SETTINGS);
  }
});

test('invalid event records cannot hide valid neighbors or crash recurrence expansion', () => {
  const broken = [null, 4, {}, { ...good, id: 'title', title: 42 },
    { ...good, id: 'date', date: '2026-02-30' }, { ...good, id: 'instant', instant: 'invalid' },
    { ...good, id: 'repeat', time: '09:00', repeat: { frequency: 'days', interval: 1, until: '2026-12-31', timeZone: 'Not/AZone' } },
    { ...good, id: 'flag', repeat: { frequency: 'monthly', until: '2026-12-31', timeZone: 'UTC', includeFebruary: 'false' } }];
  values.set(eventsKey, JSON.stringify([good, ...broken]));
  assert.deepEqual(Storage.getCustomEvents(), [good]);
  assert.ok(EventRepository.forMonth(2026, 9).some(event => event.id === good.id));
  Storage.saveCustomEventSync({ ...good, title: 'Edited' });
  assert.deepEqual(JSON.parse(values.get(eventsKey)).slice(1), broken, 'do not discard unknown saved records');
  Storage.deleteCustomEventSync(good.id);
  assert.deepEqual(JSON.parse(values.get(eventsKey)), broken);
});

test('unreadable event collections are never overwritten by save or delete', () => {
  for (const raw of ['{broken', 'null', '{}', '42']) {
    values.set(eventsKey, raw);
    assert.throws(() => Storage.saveCustomEventSync(good));
    assert.throws(() => Storage.deleteCustomEventSync(good.id));
    assert.equal(values.get(eventsKey), raw);
  }
});

test('invalid new records are rejected before saved events are touched', () => {
  values.set(eventsKey, JSON.stringify([good]));
  assert.throws(() => Storage.saveCustomEventSync({ ...good, date: 'bad' }), RangeError);
  assert.deepEqual(JSON.parse(values.get(eventsKey)), [good]);
});
