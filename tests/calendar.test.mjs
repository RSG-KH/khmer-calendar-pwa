import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { KhmerCalendar, toEpochDay, fromEpochDay } = await server.ssrLoadModule('/src/domain/KhmerCalendar.ts');
const { todayInZone, eventInstant, dateTimeInZone, isSupportedDate, localOffsetLabel, timeZoneOffsetLabel } = await server.ssrLoadModule('/src/domain/DateTime.ts');
const { CalendarWords, L } = await server.ssrLoadModule('/src/data/i18n.ts');
const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { escapeHtml } = await server.ssrLoadModule('/src/ui/html.ts');
const { MonthPickerDraft } = await server.ssrLoadModule('/src/ui/MonthPicker.ts');
const { effectiveTheme, appearanceBackground } = await server.ssrLoadModule('/src/ui/Appearance.ts');
const { ganzhiColumns, ganzhiAnimalLabel, ganzhiEmojiSummary } = await server.ssrLoadModule('/src/domain/Ganzhi.ts');
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

test('Ganzhi pillars match Android at solar boundaries and the 23:00 hour rollover', () => {
  assert.equal(ganzhiColumns(2024, 2, 3)[0].pillar.nameZh, '癸卯');
  assert.equal(ganzhiColumns(2024, 2, 4)[0].pillar.nameZh, '甲辰');
  const noon = ganzhiColumns(2026, 1, 1, 12);
  const late = ganzhiColumns(2026, 1, 1, 23);
  assert.equal(noon[2].pillar.nameZh, '乙亥');
  assert.equal(noon[3].pillar.nameZh, '壬午');
  assert.equal(late[3].pillar.nameZh, '戊子');
  assert.equal(ganzhiAnimalLabel(late[3].pillar.branch, false, false), 'Rat');
  assert.equal(ganzhiAnimalLabel(late[3].pillar.branch, true, false), 'ជូត');
  assert.equal(ganzhiAnimalLabel(late[3].pillar.clashBranch, false, true), '🐴');
  assert.equal(ganzhiEmojiSummary(2026, 9, 11), '☯️ 干支 (🐴🐔🐭 x 🐭🐰🐴)');
  assert.equal(ganzhiEmojiSummary(1800, 1, 1), null);
  const historical = ganzhiColumns(1800, 1, 1);
  assert.equal(historical[0].pillar, null);
  assert.equal(historical[1].pillar, null);
  assert.ok(historical[2].pillar);
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

test('event header UTC offsets use the saved zone and selected date', () => {
  for (const [zone, instant, expected] of [
    ['Europe/Brussels', '2026-01-15T23:45:59.999Z', 'UTC+1'],
    ['Europe/Brussels', '2026-07-15T23:45:59.999Z', 'UTC+2'],
    ['cambodia', '2026-07-15T23:45:59.999Z', 'UTC+7'],
    ['Asia/Kathmandu', '2026-07-15T23:45:59.999Z', 'UTC+5:45'],
    ['America/St_Johns', '2026-01-15T00:00:59.999Z', 'UTC-3:30'],
    ['UTC', '2026-07-15T23:45:59.999Z', 'UTC+0']
  ]) assert.equal(timeZoneOffsetLabel(zone, new Date(instant)), expected, zone);
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
  assert.equal(Storage.getSettings().backgroundAccent, true);
  assert.equal(Storage.getSettings().showLongerWeekdayNames, false);
  assert.equal(Storage.getSettings().highlightWeekdayNames, true);
  assert.equal(Storage.getSettings().showObservances, true);
  assert.equal(Storage.getSettings().showGanzhi, true);
  assert.equal(Storage.getSettings().useEmojiForGanzhiAnimals, false);
  assert.equal(Storage.getCustomEvents()[0].date, '2026-09-13');
  values.clear();
});

test('observance and Ganzhi settings persist independently', () => {
  values.clear();
  Storage.saveSettings({ ...DEFAULT_SETTINGS, showObservances: false, showGanzhi: false, useEmojiForGanzhiAnimals: true });
  const settings = Storage.getSettings();
  assert.equal(settings.showObservances, false);
  assert.equal(settings.showGanzhi, false);
  assert.equal(settings.useEmojiForGanzhiAnimals, true);
  assert.equal(settings.showWesternZodiac, true);
  values.clear();
});

test('weekday labels resolve in both languages and user text is rendered literally', () => {
  for (let day = 0; day < 7; day++) {
    for (const khmer of [true, false]) {
      for (const style of ['narrow', 'grid_long']) assert.ok(!CalendarWords.weekday(day, khmer, style).includes('calendar.'));
    }
  }
  assert.equal(escapeHtml('<img src=x> "Family" & friends'), '&lt;img src=x&gt; &quot;Family&quot; &amp; friends');
});

test('v0.8.0 personal event, notification and reminder translations match Android', () => {
  assert.equal(L.text('ui.custom.917053', false), 'Personal');
  assert.equal(L.text('ui.custom.917053', true), 'ផ្ទាល់ខ្លួន');
  assert.equal(L.text('ui.a_custom_event_saved_on_your_device.96d6e7', false), 'A personal event saved on your device.');
  assert.equal(L.text('ui.a_custom_event_saved_on_your_device.96d6e7', true), 'ព្រឹត្តិការណ៍ផ្ទាល់ខ្លួនដែលរក្សាទុកក្នុងឧបករណ៍របស់អ្នក។');
  assert.equal(L.text('ui.time_to_deliver_daily_reminders.7806df', false), 'For events with no times');
  assert.equal(L.text('ui.time_to_deliver_daily_reminders.7806df', true), 'សម្រាប់ព្រឹត្តិការណ៍គ្មានម៉ោងកំណត់');
  assert.equal(L.text('notifications.push_custom', false), 'Push personal events');
  assert.equal(L.text('notifications.push_custom', true), 'ជូនដំណឹងព្រឹត្តិការណ៍ផ្ទាល់ខ្លួន');
  assert.equal(L.text('notifications.push_observances', false), 'Push observances');
  assert.equal(L.text('notifications.push_observances', true), 'ជូនដំណឹងទិវា និងពិធីបុណ្យ');
  assert.equal(L.text('notifications.push_observances_subtitle', false), 'Festivals and others');
  assert.equal(L.text('notifications.push_observances_subtitle', true), 'ទិវា និងពិធីបុណ្យនានា');
});

test('v0.9.0 learn-more, online-search and date-label translations match Android', () => {
  assert.equal(L.text('ui.learn_more', false), 'Learn more');
  assert.equal(L.text('ui.learn_more', true), 'ស្វែងយល់បន្ថែម');
  assert.equal(L.text('ui.search_online', false), 'Search online');
  assert.equal(L.text('ui.search_online', true), 'ស្វែងរកលើអ៊ីនធឺណិត');
  assert.equal(L.text('ui.opens_in_external_browser', false), 'Opens in external browser');
  assert.equal(L.text('ui.opens_in_external_browser', true), 'បើកនៅក្នុងកម្មវិធីរុករកខាងក្រៅ');
  assert.equal(L.text('ui.no_browser_or_search_app', false), 'No browser or search app available');
  assert.equal(L.text('ui.no_browser_or_search_app', true), 'គ្មានកម្មវិធីរុករក ឬកម្មវិធីស្វែងរក');
  // Khmer date labels carry the ទី day-number prefix.
  assert.equal(CalendarWords.date(2026, 9, 8, true), 'ថ្ងៃអង្គារ ទី៨ ខែកញ្ញា ២០២៦');
  assert.equal(CalendarWords.date(2026, 9, 8, false), 'Tuesday, 8 September 2026');
});

test('new appearance preferences round-trip while preserving existing explicit theme choices', () => {
  values.clear();
  for (const theme of ['system', 'light', 'dark']) {
    Storage.saveSettings({ ...DEFAULT_SETTINGS, theme, backgroundAccent: false, showLongerWeekdayNames: true, highlightWeekdayNames: false });
    const settings = Storage.getSettings();
    assert.equal(settings.theme, theme);
    assert.equal(settings.backgroundAccent, false);
    assert.equal(settings.showLongerWeekdayNames, true);
    assert.equal(settings.highlightWeekdayNames, false);
    for (const dark of [false, true]) assert.equal(effectiveTheme(theme, dark), theme === 'system' ? (dark ? 'dark' : 'light') : theme);
  }
  assert.equal(appearanceBackground({ accent: 'rose', backgroundAccent: false }, true, '#A84465'), '#000000');
  assert.equal(appearanceBackground({ accent: 'rose', backgroundAccent: true }, true, '#A84465'), '#110D14');
  assert.equal(appearanceBackground({ accent: 'blue', backgroundAccent: true }, false, '#4564B5'), '#e1e4f0');
  values.clear();
});

test('month picker This year changes only the draft year and handles invalid intermediate input', () => {
  const draft = new MonthPickerDraft();
  draft.reset(2031, 8);
  draft.thisYear('2026-12-31');
  assert.equal(draft.year, 2026);
  assert.equal(draft.month, 8);
  for (const invalid of ['', '20', '1799', '2201', '2026.5', '2e3']) {
    draft.yearText = invalid;
    assert.equal(draft.valid, false, invalid);
    draft.shiftYear(1);
    assert.equal(draft.yearText, invalid);
  }
  draft.reset(1800, 1); draft.shiftYear(-1); assert.equal(draft.year, 1800);
  draft.reset(2200, 12); draft.shiftYear(1); assert.equal(draft.year, 2200);
  draft.reset(2031, 8); assert.equal(draft.month, 8); assert.ok(draft.valid);
  const priorZone = process.env.TZ;
  process.env.TZ = 'Europe/Brussels';
  try {
    const now = new Date('2026-12-31T18:00:00Z');
    draft.thisYear(todayInZone('local', now)); assert.equal(draft.year, 2026);
    draft.thisYear(todayInZone('cambodia', now)); assert.equal(draft.year, 2027);
    assert.equal(draft.month, 8);
  } finally {
    if (priorZone === undefined) delete process.env.TZ; else process.env.TZ = priorZone;
  }
});

test('April month-card watermarks show the animal-year transition pair, matching Android', async () => {
  const { Zodiac } = await server.ssrLoadModule('/src/domain/Zodiac.ts');
  const { KhmerDateDetails } = await server.ssrLoadModule('/src/domain/KhmerDateDetails.ts');
  for (const [year, outgoing, incoming] of [
    [2026, 5, 6],   // Snake -> Horse
    [2020, 11, 0],  // Pig -> Rat
    [1800, 7, 8],   // Goat -> Monkey (first supported April)
    [2200, 11, 0]   // Pig -> Rat (last supported April)
  ]) {
    assert.deepEqual(Zodiac.aprilAnimalTransition(year), { outgoing, incoming }, String(year));
  }
  // The engine agrees before and after the Khmer New Year transition, which is
  // why a single mid-April snapshot cannot represent the month.
  assert.equal(KhmerDateDetails.fromGregorian(2026, 4, 10).animalYear, 5);
  assert.equal(KhmerDateDetails.fromGregorian(2026, 4, 20).animalYear, 6);
  assert.equal(KhmerDateDetails.fromGregorian(2026, 6, 15).animalYear, Zodiac.animalYearIndex(2026));
});
