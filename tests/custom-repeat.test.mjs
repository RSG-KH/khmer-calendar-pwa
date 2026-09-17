import assert from 'node:assert/strict';
import { test, after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { repeatDates, validRepeat } = await server.ssrLoadModule('/src/domain/EventRepeat.ts');
const { zonedEventInstant, dateTimeInZone } = await server.ssrLoadModule('/src/domain/DateTime.ts');
const { customEventOccurrences } = await server.ssrLoadModule('/src/data/CustomEventOccurrences.ts');
const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { L } = await server.ssrLoadModule('/src/data/i18n.ts');
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
beforeEach(() => values.clear());
const rule = (frequency, until, options = {}) => ({ frequency, until, timeZone: 'Asia/Phnom_Penh', ...options });
const dates = (start, repeat, ...range) => repeatDates(start, repeat, ...range).dates;

test('every X days uses civil dates and an inclusive end date', () => {
  const expected = ['2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07', '2026-01-09'];
  for (const end of ['2026-01-09', '2026-01-10']) assert.deepEqual(dates('2026-01-01', rule('days', end, { interval: 2 })), expected);
  assert.deepEqual(dates('2028-02-28', rule('days', '2028-03-02', { interval: 1 })), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']);
});

test('weekly repeats stay anchored across months and clipped queries', () => {
  const repeat = rule('weekly', '2026-02-21');
  assert.deepEqual(dates('2026-01-31', repeat, '2026-02-01', '2026-02-28'), ['2026-02-07', '2026-02-14', '2026-02-21']);
  assert.deepEqual(dates('2026-01-31', repeat, '2026-03-01', '2026-03-31'), []);
});

test('strict monthly dates skip missing dates without drifting', () => {
  const result = repeatDates('2026-01-31', rule('monthly', '2026-12-31'));
  assert.deepEqual(result.dates, ['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31']);
  assert.equal(result.skipped.length, 5);
  assert.equal(result.affectsThirty, true);
  assert.equal(result.affectsFebruary, true);
});

test('monthly fallback checkboxes operate independently', () => {
  for (const [includeThirty, includeFebruary, count] of [[false, false, 7], [true, false, 11], [false, true, 8], [true, true, 12]]) {
    const result = dates('2026-01-31', rule('monthly', '2026-12-31', { includeThirty, includeFebruary }));
    assert.equal(result.length, count);
    assert.equal(result.includes('2026-02-28'), includeFebruary);
    assert.equal(result.includes('2026-04-30'), includeThirty);
    assert.ok(result.includes('2026-03-31'), 'February never changes the anchor');
  }
});

test('monthly 29 and 30 only offer February fallback when applicable', () => {
  assert.equal(repeatDates('2026-03-29', rule('monthly', '2026-12-31')).affectsFebruary, false);
  assert.equal(repeatDates('2028-01-29', rule('monthly', '2028-03-29')).affectsFebruary, false);
  assert.equal(repeatDates('2026-01-29', rule('monthly', '2026-02-27')).affectsFebruary, false);
  assert.equal(repeatDates('2026-01-29', rule('monthly', '2026-02-28')).affectsFebruary, true);
  assert.deepEqual(dates('2028-01-30', rule('monthly', '2028-03-30', { includeFebruary: true })), ['2028-01-30', '2028-02-29', '2028-03-30']);
});

test('yearly leap-day repeats handle leap centuries and optional February 28', () => {
  assert.deepEqual(dates('2028-02-29', rule('yearly', '2032-02-29')), ['2028-02-29', '2032-02-29']);
  assert.deepEqual(dates('2028-02-29', rule('yearly', '2032-02-29', { includeFebruary: true })), ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  assert.deepEqual(dates('2096-02-29', rule('yearly', '2104-02-29')), ['2096-02-29', '2104-02-29']);
  assert.ok(dates('1996-02-29', rule('yearly', '2004-02-29')).includes('2000-02-29'));
});

test('all frequencies require a valid end date, and days require a positive integer', () => {
  for (const frequency of ['days', 'weekly', 'monthly', 'yearly']) {
    for (const until of ['', '2025-12-31', '2026-02-30', '2201-01-01']) {
      const repeat = rule(frequency, until, { interval: 1 });
      assert.equal(validRepeat('2026-01-01', repeat), false);
      assert.deepEqual(dates('2026-01-01', repeat), []);
    }
    assert.equal(validRepeat('2026-01-01', rule(frequency, '2200-12-31', { interval: 1 })), true);
  }
  for (const interval of [undefined, 0, -1, 1.5, NaN, Infinity, '2']) assert.equal(validRepeat('2026-01-01', rule('days', '2026-12-31', { interval })), false);
});

test('supported boundaries and a 401-year daily range are finite', () => {
  const result = dates('1800-01-01', rule('days', '2200-12-31', { interval: 1 }));
  assert.equal(result.length, 146462);
  assert.equal(result.at(-1), '2200-12-31');
  assert.deepEqual(dates('2200-12-31', rule('monthly', '2200-12-31')), ['2200-12-31']);
});

test('saved zone keeps wall time across DST and resolves missing times forward', () => {
  const event = { id: 'dst', title: 'Family', date: '2026-03-22', time: '02:30', repeat: rule('weekly', '2026-04-05', { timeZone: 'Europe/Brussels' }) };
  const occurrences = customEventOccurrences(event, '2026-03-01', '2026-04-30', 'Europe/Brussels');
  assert.deepEqual(occurrences.map(item => [item.date, item.time]), [['2026-03-22', '02:30'], ['2026-03-29', '03:30'], ['2026-04-05', '02:30']]);
  assert.equal(zonedEventInstant('2026-03-29', '02:30', 'Europe/Brussels'), undefined);
  assert.equal(zonedEventInstant('2026-10-25', '02:30', 'Europe/Brussels'), '2026-10-25T00:30:00.000Z');
  assert.equal(zonedEventInstant('2026-10-04', '02:15', 'Australia/Lord_Howe', true), '2026-10-03T15:45:00.000Z');
});

test('timed occurrences cross display month/year boundaries and retain unique series IDs', () => {
  const event = { id: 'family', title: 'Family', date: '2027-01-01', time: '01:00', repeat: rule('days', '2027-01-03', { interval: 1 }) };
  const previousYear = customEventOccurrences(event, '2026-01-01', '2026-12-31', 'Europe/Brussels');
  assert.equal(previousYear.length, 1);
  assert.equal(previousYear[0].date, '2026-12-31');
  assert.equal(previousYear[0].time, '19:00');
  assert.equal(previousYear[0].id, 'family@2027-01-01');
  assert.equal(previousYear[0].seriesId, 'family');
  const nextYear = customEventOccurrences(event, '2027-01-01', '2027-12-31', 'Europe/Brussels');
  assert.equal(nextYear.length, 2);
  assert.equal(new Set([...previousYear, ...nextYear].map(item => item.id)).size, 3);
});

test('all-day series keep civil dates when changing display zone', () => {
  const event = { id: 'all-day', title: 'Holiday', date: '2026-01-31', repeat: rule('monthly', '2026-03-31', { includeFebruary: true }) };
  for (const zone of ['Asia/Phnom_Penh', 'America/Los_Angeles']) {
    assert.deepEqual(customEventOccurrences(event, '2026-01-01', '2026-12-31', zone).map(item => item.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  }
});

test('saving and deleting other events never rewrites a series anchor or timezone', () => {
  const event = { id: 'series', title: 'Meeting', date: '2027-01-01', time: '01:00', instant: '2026-12-31T18:00:00.000Z', repeat: rule('monthly', '2027-12-31') };
  Storage.saveSettings({ ...DEFAULT_SETTINGS, todayTimeZone: 'local' });
  Storage.saveCustomEventSync(event);
  Storage.saveCustomEventSync({ id: 'one', title: 'One', date: '2026-09-16' });
  Storage.deleteCustomEventSync('one');
  assert.deepEqual(Storage.getCustomEvents(), [event]);
  assert.deepEqual(JSON.parse(values.get('khmer_calendar_custom_events')), [event]);
});

test('repository shows repeats in month/day/year views; editing and deleting affect the series', () => {
  const event = { id: 'series', title: 'Family', date: '2026-01-31', repeat: rule('monthly', '2026-12-31', { includeFebruary: true, includeThirty: true }) };
  Storage.saveCustomEventSync(event);
  assert.equal(EventRepository.forMonth(2026, 2).filter(item => item.seriesId === event.id).length, 1);
  assert.equal(EventRepository.forDate('2026-02-28').find(item => item.seriesId === event.id).titleEn, 'Family');
  assert.equal(EventRepository.forYearWithCustom(2026).filter(item => item.seriesId === event.id).length, 12);
  Storage.saveCustomEventSync({ ...event, title: 'Updated', repeat: rule('monthly', '2026-12-31') });
  assert.equal(EventRepository.forDate('2026-02-28').some(item => item.seriesId === event.id), false);
  assert.equal(EventRepository.forDate('2026-03-31').find(item => item.seriesId === event.id).titleEn, 'Updated');
  Storage.deleteCustomEventSync(event.id);
  assert.equal(EventRepository.forYearWithCustom(2026).some(item => item.seriesId === event.id), false);
});

test('legacy one-off events keep their identity and projected instant', () => {
  Storage.saveSettings({ ...DEFAULT_SETTINGS, todayTimeZone: 'cambodia' });
  Storage.saveCustomEventSync({ id: 'old', title: 'Old', date: '2026-09-16', time: '01:00', instant: '2026-09-15T18:00:00.000Z' });
  const event = EventRepository.forDate('2026-09-16').find(item => item.id === 'old');
  assert.equal(event.time, '01:00');
  assert.equal(event.seriesId, undefined);
  assert.deepEqual(dateTimeInZone(new Date(event.instant), 'cambodia'), { date: event.date, time: event.time });
});

test('all repeat labels resolve in English and Khmer with matching placeholders', async () => {
  const translations = JSON.parse(await readFile(new URL('../src/data/repeat-translations.json', import.meta.url), 'utf8'));
  for (const [key, value] of Object.entries(translations)) {
    assert.ok(value.en && value.km);
    assert.equal(L.template(key, false), value.en);
    assert.equal(L.template(key, true), value.km);
    assert.deepEqual((value.en.match(/\{\w+\}/g) || []).sort(), (value.km.match(/\{\w+\}/g) || []).sort(), key);
  }
});
