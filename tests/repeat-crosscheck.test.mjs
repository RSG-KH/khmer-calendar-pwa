import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { repeatDates } = await server.ssrLoadModule('/src/domain/EventRepeat.ts');
const { isSupportedDate } = await server.ssrLoadModule('/src/domain/DateTime.ts');
const { customEventOccurrences } = await server.ssrLoadModule('/src/data/CustomEventOccurrences.ts');
const dayMs = 86_400_000;
const stamp = date => Date.parse(`${date}T00:00:00Z`);
const iso = milliseconds => new Date(milliseconds).toISOString().slice(0, 10);

// Independent oracle: inspect every calendar day instead of advancing by the rule.
function calendarWalk(start, rule, from = start, through = rule.until) {
  const anchor = new Date(stamp(start));
  const result = { dates: [], skipped: [], affectsThirty: false, affectsFebruary: false };
  for (let at = stamp(start); at <= stamp(rule.until); at += dayMs) {
    const date = iso(at);
    if (date < from || date > through) continue;
    const elapsed = (at - stamp(start)) / dayMs;
    if (rule.frequency === 'days' || rule.frequency === 'weekly') {
      if (elapsed % (rule.frequency === 'days' ? rule.interval : 7) === 0) result.dates.push(date);
      continue;
    }
    const current = new Date(at);
    if (rule.frequency === 'yearly' && current.getUTCMonth() !== anchor.getUTCMonth()) continue;
    if (current.getUTCDate() === anchor.getUTCDate()) {
      result.dates.push(date);
    } else if (current.getUTCDate() < anchor.getUTCDate() && new Date(at + dayMs).getUTCDate() === 1) {
      const february = current.getUTCMonth() === 1;
      if (february) result.affectsFebruary = true; else result.affectsThirty = true;
      (february ? rule.includeFebruary : rule.includeThirty) ? result.dates.push(date) : result.skipped.push(date);
    }
  }
  return result;
}

test('recurrence generation matches an independent calendar walk across leap centuries and clipped ranges', t => {
  const rules = [
    ...[1, 3, 31, Number.MAX_SAFE_INTEGER].map(interval => ({ frequency: 'days', interval })),
    { frequency: 'weekly' },
    ...[false, true].flatMap(includeThirty => [false, true].map(includeFebruary => ({ frequency: 'monthly', includeThirty, includeFebruary }))),
    ...[false, true].map(includeFebruary => ({ frequency: 'yearly', includeFebruary }))
  ];
  let comparisons = 0;
  for (const year of [1800, 1900, 1999, 2000, 2026, 2028, 2099, 2100, 2199]) {
    for (const suffix of ['01-01', '01-29', '01-30', '01-31', '02-28', '02-29', '03-31', '08-31', '12-31']) {
      const start = `${year}-${suffix}`;
      if (!isSupportedDate(start)) continue;
      const until = iso(Math.min(stamp(start) + 735 * dayMs, stamp('2200-12-31')));
      for (const options of rules) {
        const rule = { ...options, until, timeZone: 'Asia/Phnom_Penh' };
        assert.deepEqual(repeatDates(start, rule), calendarWalk(start, rule), JSON.stringify({ start, rule }));
        const from = iso(stamp(start) + 37 * dayMs);
        const through = iso(stamp(until) - 13 * dayMs);
        assert.deepEqual(repeatDates(start, rule, from, through), calendarWalk(start, rule, from, through), JSON.stringify({ start, rule, from, through }));
        comparisons += 2;
      }
    }
  }
  t.diagnostic(`${comparisons} full and clipped schedules agree, including skipped-date metadata.`);
});

test('month queries partition a year without losing occurrences across DST or the date line', () => {
  for (const [sourceZone, displayZone] of [
    ['Pacific/Kiritimati', 'Pacific/Pago_Pago'], ['Pacific/Pago_Pago', 'Pacific/Kiritimati'],
    ['Europe/Brussels', 'Asia/Phnom_Penh'], ['Asia/Phnom_Penh', 'Europe/Brussels']
  ]) {
    for (const frequency of ['days', 'weekly', 'monthly', 'yearly']) {
      const event = { id: 'partition', title: 'Partition', date: '2025-12-31', time: '23:45',
        repeat: { frequency, interval: 3, until: '2027-01-02', includeThirty: true, includeFebruary: true, timeZone: sourceZone } };
      const whole = customEventOccurrences(event, '2026-01-01', '2026-12-31', displayZone);
      const months = Array.from({ length: 12 }, (_, index) => {
        const from = iso(Date.UTC(2026, index, 1));
        const through = iso(Date.UTC(2026, index + 1, 0));
        return customEventOccurrences(event, from, through, displayZone);
      }).flat();
      assert.deepEqual(months, whole, `${sourceZone} -> ${displayZone}: ${frequency}`);
      assert.equal(new Set(months.map(item => item.id)).size, months.length);
    }
  }
});

test('a saved anchor in the second DST fold keeps its exact instant when repeated', () => {
  const event = { id: 'fold', title: 'Fold', date: '2026-10-25', time: '02:30', instant: '2026-10-25T01:30:00.000Z',
    repeat: { frequency: 'weekly', until: '2026-11-01', timeZone: 'Europe/Brussels' } };
  const occurrences = customEventOccurrences(event, '2026-10-01', '2026-11-30', 'Europe/Brussels');
  assert.deepEqual(occurrences.map(item => [item.date, item.time, item.instant]), [
    ['2026-10-25', '02:30', '2026-10-25T01:30:00.000Z'],
    ['2026-11-01', '02:30', '2026-11-01T01:30:00.000Z']
  ]);
});
