import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { KhmerCalendar, toEpochDay, fromEpochDay } = await server.ssrLoadModule('/src/domain/KhmerCalendar.ts');
const { todayInZone, eventInstant, dateTimeInZone, isSupportedDate, localOffsetLabel } = await server.ssrLoadModule('/src/domain/DateTime.ts');
const { CalendarWords } = await server.ssrLoadModule('/src/data/i18n.ts');
const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { escapeHtml } = await server.ssrLoadModule('/src/ui/html.ts');
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };

test('matches the Android festival and Buddhist Era anchors', () => {
  for (const [date, expected] of [
    ['2021-05-28', [2, false, 6, 2565]],
    ['2026-05-01', [15, true, 5, 2569]],
    ['2026-05-02', [1, false, 5, 2570]],
    ['2026-09-10', [13, false, 8, 2570]],
    ['2026-09-11', [14, false, 8, 2570]],
    ['2026-09-12', [1, true, 9, 2570]],
    ['2026-10-11', [15, false, 9, 2570]],
    ['2026-11-24', [15, true, 11, 2570]]
  ]) {
    const lunar = KhmerCalendar.fromGregorian(...date.split('-').map(Number));
    assert.deepEqual([lunar.day, lunar.waxing, lunar.month, lunar.buddhistYear], expected, date);
  }
});

test('all 146,462 supported days form continuous lunar months', () => {
  let previous;
  let checked = 0;
  for (let epoch = toEpochDay(1800, 1, 1); epoch <= toEpochDay(2200, 12, 31); epoch++) {
    const date = fromEpochDay(epoch);
    const lunar = KhmerCalendar.fromGregorian(date.year, date.month, date.day);
    assert.ok(lunar.day >= 1 && lunar.day <= 15);
    if (previous) {
      const ordinal = previous.day + (previous.waxing ? 0 : 15);
      assert.equal(lunar.day + (lunar.waxing ? 0 : 15), ordinal === previous.monthLength ? 1 : ordinal + 1);
      if (ordinal === previous.monthLength) assert.ok(previous.isHolyDay);
      if (lunar.buddhistYear !== previous.buddhistYear) {
        assert.deepEqual([lunar.day, lunar.waxing, lunar.month], [1, false, 5]);
        assert.equal(lunar.buddhistYear, previous.buddhistYear + 1);
      }
    }
    previous = lunar;
    checked++;
  }
  assert.equal(checked, 146462);
});

test('date navigation boundaries reject invalid dates', () => {
  for (const date of ['1799-12-31', '2201-01-01', '2026-02-30', '2026-13-01']) {
    assert.equal(isSupportedDate(date), false);
    assert.throws(() => KhmerCalendar.fromGregorian(...date.split('-').map(Number)), RangeError);
  }
  for (const date of ['1800-01-01', '2200-12-31', '2024-02-29']) assert.equal(isSupportedDate(date), true);
});

test('Cambodia midnight and local DST event times match Android semantics', () => {
  const priorZone = process.env.TZ;
  process.env.TZ = 'Europe/Brussels';
  try {
    const now = new Date('2026-09-13T18:00:00Z');
    assert.equal(todayInZone('local', now), '2026-09-13');
    assert.equal(todayInZone('cambodia', now), '2026-09-14');
    assert.equal(eventInstant('2026-03-29', '02:30', 'local'), undefined);
    assert.equal(eventInstant('2026-03-29', '02:30', 'cambodia'), '2026-03-28T19:30:00.000Z');
    assert.deepEqual(dateTimeInZone(new Date('2026-09-13T18:00:00Z'), 'cambodia'), { date: '2026-09-14', time: '01:00' });
  } finally {
    if (priorZone === undefined) delete process.env.TZ; else process.env.TZ = priorZone;
  }
});

test('local UTC labels match Android across DST, zero and fractional offsets', () => {
  const priorZone = process.env.TZ;
  try {
    for (const [zone, date, expected] of [
      ['Europe/Brussels', '2026-01-15', 'UTC+1'],
      ['Europe/Brussels', '2026-07-15', 'UTC+2'],
      ['Asia/Phnom_Penh', '2026-07-15', 'UTC+7'],
      ['Asia/Kolkata', '2026-07-15', 'UTC+5:30'],
      ['Asia/Kathmandu', '2026-07-15', 'UTC+5:45'],
      ['America/St_Johns', '2026-01-15', 'UTC-3:30'],
      ['America/New_York', '2026-01-15', 'UTC-5'],
      ['UTC', '2026-07-15', 'UTC+0']
    ]) {
      process.env.TZ = zone;
      assert.equal(localOffsetLabel(new Date(`${date}T12:00:00Z`)), expected, zone);
    }
  } finally {
    if (priorZone === undefined) delete process.env.TZ; else process.env.TZ = priorZone;
  }
});

test('saved custom events preserve their instant when changing display time zone', () => {
  values.clear();
  Storage.saveSettings({ ...DEFAULT_SETTINGS, todayTimeZone: 'cambodia' });
  Storage.saveCustomEventSync({ id: 'test', title: 'Family <birthday>', date: '2026-09-14', time: '01:00', instant: '2026-09-13T18:00:00.000Z' });
  assert.equal(EventRepository.forDate('2026-09-14').find(event => event.id === 'test').time, '01:00');
  Storage.saveSettings({ ...DEFAULT_SETTINGS, todayTimeZone: 'local' });
  const expected = dateTimeInZone(new Date('2026-09-13T18:00:00Z'), 'local');
  const event = EventRepository.forDate(expected.date).find(event => event.id === 'test');
  assert.equal(event.time, expected.time);
  assert.equal(event.instant, '2026-09-13T18:00:00.000Z');
  Storage.deleteCustomEventSync('test');
  assert.equal(Storage.getCustomEvents().length, 0);
});

test('legacy events and preferences remain readable', () => {
  values.clear();
  localStorage.setItem('khmer_calendar_settings', JSON.stringify({ language: 'en', accent: 'rose' }));
  localStorage.setItem('khmer_calendar_custom_events', JSON.stringify([{ id: 'legacy', title: 'Old event', date: '2026-09-13', time: '09:00' }]));
  assert.equal(Storage.getSettings().language, 'en');
  assert.equal(Storage.getSettings().mondayFirst, false);
  assert.equal(Storage.getCustomEvents()[0].date, '2026-09-13');
  values.clear();
});

test('weekday labels resolve in both languages and user text is rendered literally', () => {
  for (let day = 0; day < 7; day++) {
    for (const khmer of [true, false]) {
      assert.ok(!CalendarWords.weekday(day, khmer, 'narrow').includes('calendar.'));
    }
  }
  assert.equal(escapeHtml('<img src=x> "Family" & friends'), '&lt;img src=x&gt; &quot;Family&quot; &amp; friends');
});
