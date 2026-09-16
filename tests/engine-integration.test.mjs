import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { KhmerCalendar, calendarEngine, toEpochDay, fromEpochDay } = await server.ssrLoadModule('/src/domain/KhmerCalendar.ts');
const { KhmerDateDetails } = await server.ssrLoadModule('/src/domain/KhmerDateDetails.ts');
const { KhmerNewYear } = await server.ssrLoadModule('/src/domain/KhmerNewYear.ts');
const { RecurringEvents } = await server.ssrLoadModule('/src/data/RecurringEvents.ts');
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { decodeEventYear, validateEventCache } = await server.ssrLoadModule('/src/data/BundledEventDates.ts');
const { holyDayLotus } = await server.ssrLoadModule('/src/ui/HolyDayLotus.ts');
const snapshotBytes = await readFile(new URL('../src/data/events.json', import.meta.url));
const snapshot = JSON.parse(snapshotBytes);
const cache = JSON.parse(await readFile(new URL('../src/data/engine-event-dates.json', import.meta.url), 'utf8'));
globalThis.localStorage = { getItem: () => null };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('pinned engine corrects 2012 dates and separate animal/Sak transitions', () => {
  assert.equal(calendarEngine.version, '0.1.0');
  assert.deepEqual(KhmerNewYear.forYear(2012).dates, ['2012-04-13', '2012-04-14', '2012-04-15']);
  const dates = [12, 13, 14, 15].map(day => KhmerDateDetails.fromGregorian(2012, 4, day));
  assert.equal(dates[1].animalYear, (dates[0].animalYear + 1) % 12);
  assert.deepEqual(dates.map(d => d.animalYearChangesToday), [false, true, false, false]);
  assert.equal(dates[0].sak, dates[2].sak);
  assert.equal(dates[3].sak, (dates[2].sak + 1) % 10);
  assert.equal(KhmerNewYear.forYear(2024).days, 4);
  assert.throws(() => KhmerNewYear.forYear(1799), RangeError);
  assert.throws(() => KhmerCalendar.fromGregorian(NaN, 1, 1), RangeError);
});

test('second Asadh, festival offsets, weekday occurrence and anniversary rules survive mapping', () => {
  const dates = new Map(RecurringEvents.dates(2031).map(e => [e.rule.id, e.dates]));
  assert.deepEqual(dates.get('beginning_buddhist_lent'), ['2031-08-04']);
  assert.deepEqual(dates.get('buddhist_lent_candles_making_day'), ['2031-07-27']);
  assert.deepEqual(dates.get('the_ordained_dragon_monk'), ['2031-08-02']);
  assert.deepEqual(RecurringEvents.dates(2024).find(e => e.rule.id === 'khmer_new_year_2').dates, ['2024-04-14', '2024-04-15']);
  const festival = RecurringEvents.dates(2026).find(e => e.rule.id === 'pchum_ben_festival');
  assert.deepEqual(festival.dates, ['2026-10-10', '2026-10-11', '2026-10-12']);
  const weekdays = RecurringEvents.dates(2031).filter(e => e.rule.type === 'solar_nth_weekday');
  assert.ok(weekdays.length > 0);
  for (const { rule, dates: [date] } of weekdays) {
    const parsed = new Date(`${date}T00:00:00Z`);
    assert.equal(parsed.getUTCDay() || 7, rule.day);
    assert.equal(Math.ceil(parsed.getUTCDate() / 7), rule.offset);
  }
  const victory = RecurringEvents.forYear(2031).find(e => e.id === 'calculated:victory_over_genocide');
  assert.equal(victory.en, 'Victory Over Genocide Day');
  assert.ok(victory.km.includes('៥២'));
  assert.ok(!RecurringEvents.forYear(1999).some(e => e.id === victory.id));
});

test('all 100 app definitions yield 27,040 unique in-year occurrences across 401 years', () => {
  let count = 0;
  const families = new Set();
  for (let year = 1800; year <= 2200; year++) {
    const entries = RecurringEvents.dates(year);
    for (const { rule, dates } of entries) {
      families.add(rule.type);
      assert.ok(year >= rule.fromYear && year <= rule.throughYear);
      assert.ok(dates.every(date => date.startsWith(`${year}-`)));
      assert.equal(new Set(dates).size, dates.length);
      count += dates.length;
    }
    const result = KhmerNewYear.forYear(year);
    assert.equal(result.dates.length, result.days);
    assert.equal(result.startDate, result.dates[0]);
  }
  assert.equal(count, 27040);
  assert.equal(families.size, 6);
});

test('precomputed years do not call the engine to assemble their event lists', () => {
  const original = calendarEngine.fromGregorian;
  calendarEngine.fromGregorian = () => { throw new Error('Unexpected engine day scan'); };
  try {
    for (const year of [1980, 1990, 2026, 2031, 2050]) assert.ok(EventRepository.getYearEvents(year).length > 40);
  } finally { calendarEngine.fromGregorian = original; }
});

test('all 6,240 cache pairs match the reviewed Android 0.2.0 resource', () => {
  const pairs = Object.entries(cache.years).flatMap(([year, entries]) => Object.entries(entries)
    .flatMap(([id, dates]) => dates.map(date => `${id}\t${year}-${date}`))).sort();
  assert.equal(pairs.length, 6240);
  // Android 5f876f2 engine-event-dates.tsv, comments removed and rows sorted.
  assert.equal(sha(pairs.join('\n')), 'f7186cb00b1afa45b75c0981a8d525eece029a965d321c87cd94f7c982818dec');
});

test('all 71 cached years equal fresh recurrences and holy days, preserving capture precedence', () => {
  for (let year = 1980; year <= 2050; year++) {
    const actual = EventRepository.getYearEvents(year);
    const holyDays = [];
    for (let epoch = toEpochDay(year, 1, 1); epoch <= toEpochDay(year, 12, 31); epoch++) {
      const d = fromEpochDay(epoch);
      if (KhmerCalendar.fromGregorian(d.year, d.month, d.day).isHolyDay) holyDays.push(new Date(epoch * 86400000).toISOString().slice(0, 10));
    }
    assert.deepEqual(actual.filter(e => e.kind === 'HOLY_DAY').map(e => e.date), holyDays, String(year));
    const normal = actual.filter(e => e.kind !== 'HOLY_DAY');
    if (year >= 2000 && year <= 2030) {
      assert.deepEqual(normal.map(e => ({ id: e.id, date: e.date, km: e.titleKm, en: e.titleEn, kind: e.kind, url: e.officialSourceUrl || '' })),
        snapshot.filter(e => e.date.startsWith(`${year}-`)).map(({ id, date, km, en, kind, url }) => ({ id, date, km, en, kind, url: url || '' })), String(year));
      assert.ok(normal.every(e => e.basis === 'captured'));
    } else {
      const expected = RecurringEvents.forYear(year).map(e => `${e.id}:${e.date}`).sort();
      assert.deepEqual(normal.map(e => `${e.id}:${e.date}`).sort(), expected, String(year));
      assert.ok(normal.every(e => e.basis === 'calculated' && e.kind === 'OBSERVANCE' && !e.officialSourceUrl));
    }
    assert.equal(new Set(actual.map(e => `${e.id}:${e.date}`)).size, actual.length);
  }
  assert.equal(snapshot.length, 3246);
  assert.equal(sha(snapshotBytes), 'bc4ddc952e2e5485822e14590ef6f5ffa53320f0503b201b646e94d498fb70e6');
});

test('cache boundaries use correct fallback and reject invalid cache data', () => {
  for (const year of [1800, 1979, 1980, 1999, 2000, 2030, 2031, 2050, 2051, 2200]) {
    assert.equal(EventRepository.hasBundledYear(year), year >= 1980 && year <= 2050);
    assert.ok(EventRepository.getYearEvents(year).some(e => e.kind === 'HOLY_DAY'));
  }
  assert.throws(() => EventRepository.getYearEvents(2201), RangeError);
  assert.throws(() => validateEventCache({ ...cache, engineVersion: 'future' }), /metadata/);
  const missing = structuredClone(cache); delete missing.years['2000'];
  assert.throws(() => validateEventCache(missing), /metadata|Missing/);
  assert.throws(() => decodeEventYear(2000, { sil: ['02-30'] }), /Invalid cached dates/);
  assert.throws(() => decodeEventYear(2000, { sil: ['01-01', '01-01'] }), /Invalid cached dates/);
  assert.throws(() => decodeEventYear(2000, { sil: ['01-01'], unknown: ['01-01'] }), /Invalid cached event IDs/);
});

test('lotus variants follow engine holy and shaving flags, including short waning months', () => {
  const examples = new Set();
  for (let epoch = toEpochDay(2026, 1, 1); epoch <= toEpochDay(2026, 12, 31); epoch++) {
    const d = fromEpochDay(epoch), lunar = KhmerCalendar.fromGregorian(d.year, d.month, d.day);
    if (!lunar.isHolyDay && !lunar.isShavingDay) continue;
    const expected = lunar.day <= 8 ? 'holy_day_lotus.png' : 'holy_day_lotus_blossom.png';
    assert.ok(holyDayLotus(lunar).endsWith(expected));
    if (lunar.isShavingDay) {
      const tomorrow = fromEpochDay(epoch + 1);
      const next = KhmerCalendar.fromGregorian(tomorrow.year, tomorrow.month, tomorrow.day);
      assert.ok(next.isHolyDay);
      assert.equal(holyDayLotus(lunar), holyDayLotus(next));
    }
    examples.add(`${lunar.day}:${lunar.waxing}:${lunar.isHolyDay}`);
  }
  assert.ok(examples.has('14:false:true'));
  assert.ok(examples.has('8:true:true'));
  assert.ok(examples.has('8:false:true'));
});
