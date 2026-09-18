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
const { RecurringEvents, calendarCatalog } = await server.ssrLoadModule('/src/data/RecurringEvents.ts');
const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { holyDayLotus } = await server.ssrLoadModule('/src/ui/HolyDayLotus.ts');

const catalogBytes = await readFile(new URL('../src/data/khmer-calendar-data-0.3.1.json', import.meta.url));
globalThis.localStorage = { getItem: () => null };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('pinned engine corrects 2012 dates and separate animal/Sak transitions', () => {
  assert.equal(calendarEngine.version, '0.2.0');
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
    assert.equal(Math.ceil(parsed.getUTCDate() / 7), rule.occurrence ?? rule.offset);
  }
  const victory = RecurringEvents.forYear(2031).find(e => e.id === 'victory_over_genocide');
  assert.equal(victory.en, 'Victory Over Genocide Day');
  assert.ok(victory.km.includes('៥២'));
  assert.ok(RecurringEvents.forYear(1999).some(e => e.id === victory.id));
  assert.ok(!RecurringEvents.forYear(1978).some(e => e.id === victory.id));
});

test('all 111 app definitions yield 30,371 unique in-year occurrences across 401 years', () => {
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
  assert.equal(count, 30371);
  assert.equal(families.size, 7);
});

test('canonical Schema v2 catalog integrity and checksum match specification', () => {
  assert.equal(sha(catalogBytes), '2c0243f55979737b96046fc09c26e09c4043be5c420d76bbcbc7443707e042db');
  assert.equal(calendarCatalog.schemaVersion, 2);
  assert.equal(calendarCatalog.dataVersion, '0.3.1');
  assert.equal(calendarCatalog.events.length, 137);

  const recurring = calendarCatalog.events.filter(e => e.rule);
  const staticEvents = calendarCatalog.events.filter(e => e.dates);
  assert.equal(recurring.length, 111);
  assert.equal(staticEvents.length, 26);
  assert.equal(staticEvents.filter(e => e.kind === 'traditional').length, 0);
  assert.equal(staticEvents.filter(e => e.kind === 'historical').length, 26);

  assert.equal(calendarCatalog.holidayCalendars.length, 8);
  assert.deepEqual(calendarCatalog.holidayCalendars.map(c => c.year), [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  assert.equal(calendarCatalog.overrides.length, 22);
  const sihamoniOverrides = calendarCatalog.overrides.filter(o => o.eventId === 'king_sihamoni_birthday');
  assert.equal(sihamoniOverrides.length, 15);
  assert.deepEqual(sihamoniOverrides.map(o => o.year), Array.from({ length: 15 }, (_, i) => 2005 + i));
  const chineseOverrides = calendarCatalog.overrides.filter(o => o.eventId.startsWith('chinese_'));
  assert.equal(chineseOverrides.length, 3);
  assert.deepEqual(chineseOverrides.map(o => ({ eventId: o.eventId, year: o.year })), [
    { eventId: 'chinese_qingming_festival', year: 2009 },
    { eventId: 'chinese_qingming_festival', year: 2029 },
    { eventId: 'chinese_zongzi_festival', year: 2013 }
  ]);
  assert.equal(calendarCatalog.sources.length, 12);
  assert.equal(calendarCatalog.eventCalendars.length, 0);
});

test('static date-backed events match their exact dates across 2000-2030', () => {
  const y2000 = EventRepository.getYearEvents(2000);
  const chinese2000 = y2000.filter(e => e.id.startsWith('chinese_'));
  assert.ok(chinese2000.length >= 8);
  assert.equal(chinese2000.find(e => e.id === 'chinese_kitchen_god_festival')?.date, '2000-01-30');
  assert.equal(chinese2000.find(e => e.id === 'chinese_new_year_eve')?.date, '2000-02-04');
  assert.ok(chinese2000.every(e => e.basis === 'calculated'));

  // Chinese festival overrides
  const y2009 = EventRepository.getYearEvents(2009);
  const qingming2009 = y2009.find(e => e.id === 'chinese_qingming_festival');
  assert.equal(qingming2009?.date, '2009-04-05');
  assert.equal(qingming2009?.basis, 'corrected');

  const y2029 = EventRepository.getYearEvents(2029);
  const qingming2029 = y2029.find(e => e.id === 'chinese_qingming_festival');
  assert.equal(qingming2029?.date, '2029-04-05');
  assert.equal(qingming2029?.basis, 'corrected');

  const y2013 = EventRepository.getYearEvents(2013);
  const zongzi2013 = y2013.find(e => e.id === 'chinese_zongzi_festival');
  assert.equal(zongzi2013?.date, '2013-06-13');
  assert.equal(zongzi2013?.basis, 'corrected');

  // UNESCO milestone dates
  const y2008 = EventRepository.getYearEvents(2008);
  assert.ok(y2008.some(e => e.id === 'static_temple_of_preah_vihear_was_inscribed_on_the_unesco' && e.date === '2008-07-07' && e.basis === 'recorded'));
  const y2016 = EventRepository.getYearEvents(2016);
  assert.ok(y2016.some(e => e.id === 'static_chapei_dang_veng_inscribed_on_the_list_of_intangib' && e.date === '2016-11-30'));
  const y2022 = EventRepository.getYearEvents(2022);
  assert.ok(y2022.some(e => e.id === 'static_kun_lbokator_inscribed_on_the_representative_list_' && e.date === '2022-11-29'));
  const y2023 = EventRepository.getYearEvents(2023);
  assert.ok(y2023.some(e => e.id === 'static_koh_ker_inscribed_on_the_unesco_world_heritage_lis' && e.date === '2023-09-17'));
  const y2024 = EventRepository.getYearEvents(2024);
  assert.ok(y2024.some(e => e.id === 'static_krama_inscribed_on_the_representative_list_of_the_' && e.date === '2024-12-04'));
});

test('historical King Sihamoni birthday overrides apply 3-day celebrations from 2005 to 2019 and 1-day from 2020 onward', () => {
  for (let year = 2005; year <= 2019; year++) {
    const bday = EventRepository.getYearEvents(year).filter(e => e.id === 'king_sihamoni_birthday');
    assert.equal(bday.length, 3, `Year ${year} should have 3 birthday dates`);
    assert.deepEqual(bday.map(e => e.date), [`${year}-05-13`, `${year}-05-14`, `${year}-05-15`]);
    assert.ok(bday.every(e => e.basis === 'corrected'));
  }

  // Rule starts in 2005 (King Sihamoni crowned October 2004)
  assert.equal(EventRepository.getYearEvents(2004).filter(e => e.id === 'king_sihamoni_birthday').length, 0);

  for (let year of [2020, 2026, 2030]) {
    const bday = EventRepository.getYearEvents(year).filter(e => e.id === 'king_sihamoni_birthday');
    assert.equal(bday.length, 1, `Year ${year} should have 1 birthday date`);
    assert.equal(bday[0].date, `${year}-05-14`);
    assert.ok(bday[0].basis === 'calculated' || bday[0].basis === 'official');
  }
});

test('all 8 official government holiday calendars (2020–2027) apply public holiday status and sub-decree citations', () => {
  for (let year = 2020; year <= 2027; year++) {
    const yearEvents = EventRepository.getYearEvents(year);
    const holidays = yearEvents.filter(e => e.kind === 'HOLIDAY');
    assert.ok(holidays.length >= 21, `Year ${year} should have at least 21 official holiday records`);
    assert.ok(holidays.every(e => e.basis === 'official'));
    assert.ok(holidays.every(e => e.sourceIds && e.sourceIds.length > 0));
    assert.ok(holidays.some(e => e.citation && (e.citation.includes('Anukret') || e.citation.includes('calendar') || e.citation.includes('Sub-decree'))));
  }

  // Verify sub-decree citations specifically
  assert.equal(EventRepository.getYearEvents(2020).find(e => e.kind === 'HOLIDAY')?.citation, 'Anukret No. 112 ANKr.BK, 02 August 2019');
  assert.equal(EventRepository.getYearEvents(2021).find(e => e.kind === 'HOLIDAY')?.citation, 'Anukret No. 131 ANKr.BK, 26 August 2020');
  assert.equal(EventRepository.getYearEvents(2022).find(e => e.kind === 'HOLIDAY')?.citation, 'Anukret No. 145 ANKr.BK, 19 August 2021');
  assert.equal(EventRepository.getYearEvents(2023).find(e => e.kind === 'HOLIDAY')?.citation, 'Anukret No. 166 ANKr.BK, 12 August 2022');
  assert.equal(EventRepository.getYearEvents(2024).find(e => e.kind === 'HOLIDAY')?.citation, 'Anukret No. 230 ANKr.BK, 18 August 2023');
  assert.equal(EventRepository.getYearEvents(2027).find(e => e.kind === 'HOLIDAY')?.citation, 'Anukret No. 198 ANKr.BK, 16 September 2026');

  // Verify observances and holy days do not have official citations or provenance notes
  const observances2026 = EventRepository.getYearEvents(2026).filter(e => e.kind === 'OBSERVANCE' || e.kind === 'HOLY_DAY');
  assert.ok(observances2026.every(e => !e.citation && !e.citationEn && !e.citationKm && !e.officialSourceUrl));
  const kohKer = EventRepository.getYearEvents(2026).find(e => e.id === 'koh_ker_unesco');
  assert.ok(kohKer, 'Koh Ker observance should exist in 2026');
  assert.equal(kohKer.kind, 'OBSERVANCE');
  assert.equal(kohKer.basis, 'calculated');
  assert.equal(kohKer.citation, undefined);
  assert.equal(kohKer.officialSourceUrl, undefined);

  // Verify no duplicate holiday/observance for the same event on holiday dates
  for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
    const yearEvents = EventRepository.getYearEvents(year);
    const holidays = yearEvents.filter(e => e.kind === 'HOLIDAY');
    for (const h of holidays) {
      const duplicateObservance = yearEvents.find(e => e.date === h.date && e.kind === 'OBSERVANCE' && (
        e.id === h.id ||
        (e.id.includes(h.id) || h.id.includes(e.id))
      ));
      assert.equal(
        duplicateObservance,
        undefined,
        `Expected no duplicate observance for holiday ${h.id} on ${h.date} in ${year}`
      );
    }
  }

  // Verify multi-day holidays have day-specific names applied
  const kny2026 = EventRepository.getYearEvents(2026).filter(e => e.id.startsWith('khmer_new_year'));
  assert.equal(kny2026.length, 3);
  assert.equal(kny2026[0].titleEn, 'Khmer New Year - Moha Sankranta at 10:48 AM');
  assert.equal(kny2026[1].titleEn, 'Khmer New Year - Veareak Vanabat');
  assert.equal(kny2026[2].titleEn, 'Khmer New Year - Veareak Laeung Sak');
  assert.ok(kny2026[0].titleKm.includes('១០:៤៨ AM'));

  // Verify 100% explicit eventId linkage and 0 mismatches across all 8 holiday calendars
  const catalogEventIds = new Set(calendarCatalog.events.map(e => e.id));
  for (const cal of calendarCatalog.holidayCalendars) {
    for (const h of cal.holidays) {
      assert.ok(h.eventId, `Holiday ${h.id} in ${cal.year} must have explicit eventId`);
      assert.ok(catalogEventIds.has(h.eventId), `Holiday eventId ${h.eventId} must exist in events catalog`);
    }
  }

  // Verify sources contain no raw SHA-256 build provenance strings
  const sha256Regex = /\b[a-f0-9]{64}\b/i;
  for (const source of calendarCatalog.sources) {
    if (source.notes) {
      assert.ok(!sha256Regex.test(source.notes), `Source ${source.id} notes should not contain raw SHA-256 string`);
    }
  }

  // Verify {anniversary} is always properly formatted in holiday titles
  for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
    const yearEvents = EventRepository.getYearEvents(year);
    for (const ev of yearEvents) {
      assert.ok(!ev.titleKm.includes('{anniversary}'), `Year ${year} event ${ev.id} titleKm has unreplaced {anniversary}`);
      assert.ok(!ev.titleEn.includes('{anniversary}'), `Year ${year} event ${ev.id} titleEn has unreplaced {anniversary}`);
    }
  }

  const y2027 = EventRepository.getYearEvents(2027);
  const victory2027 = y2027.find(e => e.id === 'victory_over_genocide');
  assert.ok(victory2027.titleKm.includes('៤៨'), '2027 Victory Day should show 48th anniversary in Khmer');
  const women2027 = y2027.find(e => e.id === 'international_women_day');
  assert.ok(women2027.titleKm.includes('១១៦'), '2027 Women Day should show 116th anniversary in Khmer');
  const labor2027 = y2027.find(e => e.id === 'international_labor_day');
  assert.ok(labor2027.titleKm.includes('១៤១'), '2027 Labor Day should show 141st anniversary in Khmer');
});

test('in-memory year cache serves subsequent requests and year boundaries enforce 1800-2200 range', () => {
  for (const year of [1800, 1980, 2000, 2026, 2050, 2200]) {
    assert.equal(EventRepository.hasBundledYear(year), true);
    const events = EventRepository.getYearEvents(year);
    assert.ok(events.length > 40);
    assert.ok(events.some(e => e.kind === 'HOLY_DAY'));
    // Cached identity
    assert.strictEqual(EventRepository.getYearEvents(year), events);
  }

  assert.equal(EventRepository.hasBundledYear(1799), false);
  assert.equal(EventRepository.hasBundledYear(2201), false);
  assert.throws(() => EventRepository.getYearEvents(1799), RangeError);
  assert.throws(() => EventRepository.getYearEvents(2201), RangeError);
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

test('event details dialog renders clean categories and descriptions without raw SHA-256 provenance notes', async () => {
  class MockElement {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.attributes = {};
      this._html = '';
      this.style = { setProperty() {}, removeProperty() {} };
    }
    get innerHTML() { return this._html; }
    set innerHTML(val) { this._html = val; }
    addEventListener() {}
    removeEventListener() {}
    querySelector() { return new MockElement('div'); }
    querySelectorAll() { return []; }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }
    classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    focus() {}
  }
  globalThis.HTMLElement = MockElement;
  globalThis.document = {
    createElement(tag) { return new MockElement(tag); },
    getElementById() { return new MockElement('div'); },
    body: { appendChild() {} }
  };
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
    addEventListener() {},
    removeEventListener() {},
    visualViewport: { width: 1024, height: 768, offsetTop: 0, offsetLeft: 0, addEventListener() {}, removeEventListener() {} }
  };

  const { EventDetailsDialogModal } = await server.ssrLoadModule('/src/ui/Modals.ts');
  const modal = new EventDetailsDialogModal(() => {}, () => {});

  // 1. Koh Ker (Sept 17, 2026 observance)
  const kohKer = EventRepository.getYearEvents(2026).find(e => e.id === 'koh_ker_unesco');
  modal.open(kohKer, true);
  const kohKerHtml = modal.overlay.innerHTML;
  assert.ok(kohKerHtml.includes('ព្រឹត្តិការណ៍តាមការគណនា'));
  assert.ok(kohKerHtml.includes('ការគណនាប្រតិទិនធ្វើឡើងដោយ Khmer Calendar Engine។'));
  assert.ok(kohKerHtml.includes('Koh Ker inscribed on the UNESCO World Heritage List'));
  assert.equal(kohKerHtml.includes('SHA-256'), false, 'Must not contain SHA-256');
  assert.equal(kohKerHtml.includes('calendar-events.tsv'), false, 'Must not contain calendar-events.tsv');
  assert.equal(kohKerHtml.includes('khmer-lunar-calendar-capture'), false, 'Must not contain source id');
  assert.equal(kohKerHtml.includes('event-citation'), false, 'Must not have citation block on observances');

  // 2. Official Holiday (Sept 24, 2026 Constitution Day)
  const constDay = EventRepository.getYearEvents(2026).find(e => e.date === '2026-09-24' && e.kind === 'HOLIDAY');
  modal.open(constDay, true);
  const constHtml = modal.overlay.innerHTML;
  assert.ok(constHtml.includes('ថ្ងៃព្រហស្បតិ៍, ២៤ ខែកញ្ញា ២០២៦'), 'Full Khmer date format matching Android');
  assert.ok(constHtml.includes('ថ្ងៃឈប់សម្រាក'));
  assert.ok(constHtml.includes('បានបញ្ជាក់ក្នុងប្រតិទិនថ្ងៃឈប់សម្រាកផ្លូវការ ឆ្នាំ២០២៦។'));
  assert.ok(constHtml.includes('អនុក្រឹត្យលេខ ១៦៧'));
  assert.ok(constHtml.includes('event-citation'));
  const holidayIdx = constHtml.indexOf('ថ្ងៃឈប់សម្រាក');
  const titleEnIdx = constHtml.indexOf('Constitution Day');
  const verifiedIdx = constHtml.indexOf('បានបញ្ជាក់ក្នុងប្រតិទិនថ្ងៃឈប់សម្រាកផ្លូវការ');
  assert.ok(holidayIdx < titleEnIdx, 'Holiday subtitle must appear before English title');
  assert.ok(titleEnIdx < verifiedIdx, 'English title must appear directly under holiday subtitle, before verified description');
  assert.equal(constHtml.includes('<a href='), false, 'Must not render clickable URL link in event details');
  assert.equal(constHtml.includes('SHA-256'), false);
});

