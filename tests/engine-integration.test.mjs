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
const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');

const catalogBytes = await readFile(new URL('../src/data/khmer-calendar-data-0.5.0.json', import.meta.url));
const storageMap = new Map();
globalThis.localStorage = {
  getItem: k => storageMap.get(k) ?? null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: k => storageMap.delete(k),
  clear: () => storageMap.clear()
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('pinned engine corrects 2012 dates and separate animal/Sak transitions', () => {
  assert.equal(calendarEngine.version, '0.6.0');
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
  // Traditional Pchum Ben structure since catalog 0.4.3: Ben 14, the single 15-roach climax, then Post Pchum Ben Festival.
  assert.deepEqual(RecurringEvents.dates(2026).find(e => e.rule.id === 'ben_14').dates, ['2026-10-10']);
  assert.deepEqual(RecurringEvents.dates(2026).find(e => e.rule.id === 'pchum_ben_festival').dates, ['2026-10-11']);
  assert.deepEqual(RecurringEvents.dates(2026).find(e => e.rule.id === 'post_pchum_ben_festival').dates, ['2026-10-12']);
  const weekdays = RecurringEvents.dates(2031).filter(e => e.rule.type === 'solar_nth_weekday');
  assert.ok(weekdays.length > 0);
  for (const { rule, dates: [date] } of weekdays) {
    const parsed = new Date(`${date}T00:00:00Z`);
    assert.equal(parsed.getUTCDay() || 7, rule.day);
    assert.equal(Math.ceil(parsed.getUTCDate() / 7), rule.occurrence ?? rule.offset);
  }
  const victory = RecurringEvents.forYear(2031).find(e => e.id === 'victory_over_genocide');
  assert.equal(victory.en, 'Victory Over Genocide Day · 52nd');
  assert.ok(victory.km.includes('៥២'));
  assert.ok(RecurringEvents.forYear(1999).some(e => e.id === victory.id));
  assert.ok(!RecurringEvents.forYear(1978).some(e => e.id === victory.id));
});

test('all 113 app definitions yield 30,371 unique in-year occurrences across 401 years', () => {
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

test('canonical Schema v3 catalog integrity and checksum match specification', () => {
  assert.equal(sha(catalogBytes), '0cfe85d37d2ff22ead2559e106b965552853e40e59e5ef7ec795fd1f8975653e');
  assert.equal(calendarCatalog.schemaVersion, 3);
  assert.equal(calendarCatalog.dataVersion, '0.5.0');
  assert.equal(calendarCatalog.events.length, 139);

  const recurring = calendarCatalog.events.filter(e => e.rule);
  const staticEvents = calendarCatalog.events.filter(e => e.dates);
  assert.equal(recurring.length, 113);
  assert.equal(staticEvents.length, 26);
  assert.equal(staticEvents.filter(e => e.kind === 'traditional').length, 0);
  assert.equal(staticEvents.filter(e => e.kind === 'historical').length, 26);

  assert.equal(calendarCatalog.holidayCalendars.length, 12);
  assert.deepEqual(calendarCatalog.holidayCalendars.map(c => c.year), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
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
  assert.equal(calendarCatalog.sources.length, 46);
  assert.equal(calendarCatalog.eventCalendars.length, 0);

  // Schema v3 verified newYearArrivals catalog
  assert.ok(calendarCatalog.newYearArrivals);
  assert.equal(calendarCatalog.newYearArrivals.length, 19);
  assert.deepEqual(
    calendarCatalog.newYearArrivals.map(a => a.year),
    [1997, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
  );
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
    if (year <= 2015) {
      assert.ok(bday.every(e => e.basis === 'corrected'));
    } else {
      assert.ok(bday.every(e => e.basis === 'official'));
    }
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

test('all 12 official government holiday calendars (2016–2027) apply public holiday status and sub-decree citations', () => {
  for (let year = 2016; year <= 2027; year++) {
    const yearEvents = EventRepository.getYearEvents(year);
    const holidays = yearEvents.filter(e => e.kind === 'HOLIDAY');
    assert.ok(holidays.length >= 21, `Year ${year} should have at least 21 official holiday records`);
    assert.ok(holidays.every(e => e.basis === 'official'));
    assert.ok(holidays.every(e => e.sourceIds && e.sourceIds.length > 0));
    assert.ok(holidays.some(e => e.citation && (e.citation.includes('Anukret') || e.citation.includes('calendar') || e.citation.includes('Sub-decree'))));
  }

  // Verify sub-decree citations specifically
  assert.equal(EventRepository.getYearEvents(2016).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 137 ANKr.BK, 01 October 2015, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2017).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 223 ANKr.BK, 27 October 2016, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2018).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 202 ANKr.BK, 28 November 2017, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2019).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 126 ANKr.BK, 04 October 2018, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2020).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 112 ANKr.BK, 02 August 2019, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2021).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 131 ANKr.BK, 26 August 2020, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2022).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 145 ANKr.BK, 19 August 2021, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2023).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 166 ANKr.BK, 12 August 2022, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2024).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 230 ANKr.BK, 18 August 2023, signed by Prime Minister Hun Sen');
  assert.equal(EventRepository.getYearEvents(2027).find(e => e.kind === 'HOLIDAY')?.citation, '📜 Anukret No. 198 ANKr.BK, 16 September 2026, signed by Prime Minister Hun Manet');

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
  for (const year of [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
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

  // Verify multi-day holidays have day-specific names applied and Moha Sangkran has natural arrival time
  const kny2026 = EventRepository.getYearEvents(2026).filter(e => e.id.startsWith('khmer_new_year'));
  assert.equal(kny2026.length, 3);
  assert.equal(kny2026[0].titleEn, 'Khmer New Year – Moha Sankranta 10:48 AM (Official time)');
  assert.equal(kny2026[0].titleKm, 'ពិធី​បុណ្យ​ចូល​ឆ្នាំ​ថ្មី ប្រពៃណី​ជាតិ – មហា​សង្ក្រាន្ត ម៉ោង ១០:៤៨ ព្រឹក (ម៉ោងផ្លូវការ)');
  assert.equal(kny2026[1].titleEn, 'Khmer New Year - Veareak Vanabat');
  assert.equal(kny2026[2].titleEn, 'Khmer New Year - Veareak Laeung Sak');

  // Verify Moha Sangkran arrival time across benchmark years (evidenced TVK vs engine estimate)
  const kny1997 = EventRepository.getYearEvents(1997).find(e => e.id === 'khmer_new_year_1');
  assert.equal(kny1997.titleEn, 'Khmer New Year – Moha Sankranta 10:48 PM (Official time)');
  assert.equal(kny1997.titleKm, 'ពិធី​បុណ្យ​ចូល​ឆ្នាំ​ថ្មី ប្រពៃណី​ជាតិ – មហា​សង្ក្រាន្ត ម៉ោង ១០:៤៨ យប់ (ម៉ោងផ្លូវការ)');
  assert.ok(kny1997.sourceIds.includes('arrival-tvk-playlist'));

  const kny2024 = EventRepository.getYearEvents(2024).find(e => e.id === 'khmer_new_year_1');
  assert.equal(kny2024.titleEn, 'Khmer New Year – Moha Sankranta 10:17:24 PM (Official time)');
  assert.equal(kny2024.titleKm, 'ពិធី​បុណ្យ​ចូល​ឆ្នាំ​ថ្មី ប្រពៃណី​ជាតិ – មហា​សង្ក្រាន្ត ម៉ោង ១០:១៧:២៤ យប់ (ម៉ោងផ្លូវការ)');
  assert.ok(kny2024.sourceIds.includes('arrival-tvk-2024'));

  const kny2027 = EventRepository.getYearEvents(2027).find(e => e.id === 'khmer_new_year_1');
  assert.equal(kny2027.titleEn, 'Khmer New Year – Moha Sankranta 4:48 PM (Estimated time)');
  assert.equal(kny2027.titleKm, 'ពិធី​បុណ្យ​ចូល​ឆ្នាំ​ថ្មី ប្រពៃណី​ជាតិ – មហា​សង្ក្រាន្ត ម៉ោង ០៤:៤៨ ល្ងាច (ម៉ោងប៉ាន់ស្មាន)');

  // Engine v0.6.0 arrivalEstimate contract on KhmerNewYear
  const ny2027 = KhmerNewYear.forYear(2027);
  assert.deepEqual(ny2027.arrivalEstimate, { minuteOfDay: 1008, hour: 16, minute: 48 });

  // Verify 100% explicit eventId linkage and 0 mismatches across all 12 holiday calendars
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
  for (const year of [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
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

  // English anniversary counts render with ordinal suffixes in both the holiday and rule layers.
  const y2026 = EventRepository.getYearEvents(2026);
  const jan7 = y2026.find(e => e.id === 'victory_over_genocide' && e.kind === 'HOLIDAY');
  assert.equal(jan7.titleEn, 'Victory Over Genocide Day · 47th');
  assert.equal(jan7.anniversaryBase, 1979);
  const rights2016 = EventRepository.getYearEvents(2016).find(e => e.id === 'international_human_rights_day');
  assert.equal(rights2016.titleEn, 'International Human Rights Day · 68th');
  assert.equal(rights2016.anniversaryBase, 1948);
  const nov9_2028 = EventRepository.getYearEvents(2028).find(e => e.id === 'independence_day');
  assert.equal(nov9_2028.titleEn, 'Independence Day · 75th');
  assert.equal(nov9_2028.anniversaryBase, 1953);
});

test('bundled knowledge covers every catalog event with complete bilingual entries', async () => {
  const { knowledgeById } = await server.ssrLoadModule('/src/data/RecurringEvents.ts');
  assert.deepEqual(new Set(calendarCatalog.events.map(e => e.id)), new Set(knowledgeById.keys()));
  assert.equal(knowledgeById.size, 139);
  for (const entry of knowledgeById.values()) {
    assert.ok(entry.id && entry.category, `Knowledge entry ${entry.id} needs id and category`);
    assert.ok(entry.nameKm && entry.nameEn, `Knowledge entry ${entry.id} needs both names`);
    assert.ok(entry.summaryKm && entry.summaryEn, `Knowledge entry ${entry.id} needs both summaries`);
  }
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
    querySelector(selector) {
      const child = new MockElement('div');
      if (selector === '.date-details-header-badge') {
        Object.defineProperty(child, 'innerHTML', {
          get: () => child._html,
          set: (val) => {
            child._html = val;
            this._html = this._html.replace(
              /(<div class="date-details-header-badge">)[\s\S]*?(<\/div>)/,
              `$1${val}$2`
            );
          }
        });
        return child;
      }
      if (selector && selector.includes('.ganzhi-table-wrap:not(.western-zodiac-table-wrap)')) {
        Object.defineProperty(child, 'outerHTML', {
          set: (val) => {
            this._html = this._html.replace(
              /<div class="ganzhi-table-wrap">[\s\S]*?<\/table>(\s*<p class="ganzhi-range-note">.*?<\/p>)?\s*<\/div>/,
              val
            );
          }
        });
        return child;
      }
      if (selector && selector.includes('.western-zodiac-table-wrap')) {
        Object.defineProperty(child, 'outerHTML', {
          set: (val) => {
            this._html = this._html.replace(
              /<div class="western-zodiac-table-wrap">[\s\S]*?<\/table>\s*<\/div>/,
              val
            );
          }
        });
        return child;
      }
      return child;
    }
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
    querySelector() { return null; },
    querySelectorAll() { return []; },
    dispatchEvent() { return true; },
    body: { appendChild() {} }
  };
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    setTimeout: (...args) => {
      const t = setTimeout(...args);
      t.unref?.();
      return t;
    },
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
  assert.ok(kohKerHtml.includes('font-size: calc(12px * var(--font-scale))'), 'Engine calculations description should use 12px');
  assert.ok(kohKerHtml.includes('Koh Ker inscribed on the UNESCO World Heritage List'));
  assert.equal(kohKerHtml.includes('SHA-256'), false, 'Must not contain SHA-256');
  assert.equal(kohKerHtml.includes('calendar-events.tsv'), false, 'Must not contain calendar-events.tsv');
  assert.equal(kohKerHtml.includes('khmer-lunar-calendar-capture'), false, 'Must not contain source id');
  assert.equal(kohKerHtml.includes('event-citation'), false, 'Must not have citation block on observances');

  // 2. Official Holiday (Sept 24, 2026 Constitution Day)
  const constDay = EventRepository.getYearEvents(2026).find(e => e.date === '2026-09-24' && e.kind === 'HOLIDAY');
  modal.open(constDay, true);
  const constHtml = modal.overlay.innerHTML;
  assert.ok(constHtml.includes('ថ្ងៃព្រហស្បតិ៍ ទី២៤ ខែកញ្ញា ២០២៦'), 'Full Khmer date format with ទី day prefix, matching Android');
  assert.ok(constHtml.includes('១៣កើត ខែភទ្របទ<br>ឆ្នាំមមី អដ្ឋស័ក'), 'Lunar day, month, animal year, and sak');
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
  assert.ok(constHtml.includes('Constitution Day · 33rd (1993)'), 'Translated title shows ordinal count and origin year');
  assert.ok(constHtml.includes('btn-ev-learn-more'), 'Non-custom events expose a Learn more action');

  // 2b. Learn more dialog: stacked bilingual knowledge, app language first, plus the online search query
  const { LearnMoreModal, buildOnlineSearchQuery } = await server.ssrLoadModule('/src/ui/Modals.ts');
  const { escapeHtml } = await server.ssrLoadModule('/src/ui/html.ts');
  const learnModal = new LearnMoreModal();
  learnModal.open(constDay, false);
  const learnHtml = learnModal.overlay.innerHTML;
  const { knowledgeById } = await server.ssrLoadModule('/src/data/RecurringEvents.ts');
  const entry = knowledgeById.get('constitution_day');
  const summaryEnIdx = learnHtml.indexOf(escapeHtml(entry.summaryEn));
  const summaryKmIdx = learnHtml.indexOf(escapeHtml(entry.summaryKm));
  assert.ok(summaryEnIdx >= 0 && summaryKmIdx >= 0, 'Both language summaries render');
  assert.ok(summaryEnIdx < summaryKmIdx, 'English summary must lead when the app is English');
  assert.ok(learnHtml.includes('Search online'), 'Search online action present');
  assert.ok(learnHtml.includes('Opens in external browser'), 'External-browser hint labels the open-in-new icon');
  assert.equal(buildOnlineSearchQuery(constDay, false), 'Constitution Day · 33rd Cambodia history and significance');
  assert.equal(buildOnlineSearchQuery(constDay, true), `${constDay.titleKm} ប្រវត្តិ សារៈសំខាន់`);
  // Global observances must not carry the Cambodia anchor.
  const newYearDay = EventRepository.getYearEvents(2026).find(e => e.id === 'new_year_day');
  assert.equal(buildOnlineSearchQuery(newYearDay, false), "New Year's Day history and significance");

  // 3. Date Details Dialog: Shaving Day 🙏 vs Holy Day Lotus (enabled vs disabled)
  const { DateDetailsDialogModal } = await server.ssrLoadModule('/src/ui/Modals.ts');
  const dateModal = new DateDetailsDialogModal(() => {}, () => {});

  // When holyDayMarkers is enabled (default):
  Storage.saveSettings({ ...DEFAULT_SETTINGS, holyDayMarkers: true });

  // 2026-09-25 is Shaving Day (Eve of Buddhist Holy Day)
  dateModal.open('2026-09-25', [], false);
  const shavingHtmlEn = dateModal.overlay.innerHTML;
  assert.ok(shavingHtmlEn.includes('🙏'), 'Shaving day must display prayer icon 🙏');
  assert.ok(shavingHtmlEn.includes('Shaving Day'));
  assert.equal(shavingHtmlEn.includes('Eve of Buddhist Holy Day'), false);
  assert.equal(shavingHtmlEn.includes('holy_day_lotus'), false, 'Shaving day must NOT display lotus image');

  dateModal.open('2026-09-25', [], true);
  const shavingHtmlKm = dateModal.overlay.innerHTML;
  assert.ok(shavingHtmlKm.includes('🙏'), 'Shaving day in Khmer must display prayer icon 🙏');
  assert.ok(shavingHtmlKm.includes('ថ្ងៃកោរ'));
  assert.equal(shavingHtmlKm.includes('holy_day_lotus'), false, 'Shaving day must NOT display lotus image');

  // 2026-09-26 is Holy Day
  dateModal.open('2026-09-26', [], false);
  const holyHtmlEn = dateModal.overlay.innerHTML;
  assert.ok(holyHtmlEn.includes('holy_day_lotus_blossom.png'), 'Holy day must display lotus image');
  assert.ok(holyHtmlEn.includes('Buddhist Holy Day'));
  assert.equal(holyHtmlEn.includes('🙏'), false, 'Holy day must NOT display prayer icon 🙏');

  // When holyDayMarkers is disabled:
  Storage.saveSettings({ ...DEFAULT_SETTINGS, holyDayMarkers: false });

  // Shaving Day must NOT show 🙏 or shaving day label
  dateModal.open('2026-09-25', [], false);
  const disabledShavingHtmlEn = dateModal.overlay.innerHTML;
  assert.equal(disabledShavingHtmlEn.includes('🙏'), false, 'Disabled holyDayMarkers must not show 🙏 on shaving day');
  assert.equal(disabledShavingHtmlEn.includes('Shaving Day'), false, 'Disabled holyDayMarkers must not show shaving day label');

  dateModal.open('2026-09-25', [], true);
  const disabledShavingHtmlKm = dateModal.overlay.innerHTML;
  assert.equal(disabledShavingHtmlKm.includes('🙏'), false, 'Disabled holyDayMarkers must not show 🙏 on shaving day');
  assert.equal(disabledShavingHtmlKm.includes('ថ្ងៃកោរ'), false, 'Disabled holyDayMarkers must not show ថ្ងៃកោរ text');

  // Holy Day must NOT show lotus or holy day label
  dateModal.open('2026-09-26', [], false);
  const disabledHolyHtmlEn = dateModal.overlay.innerHTML;
  assert.equal(disabledHolyHtmlEn.includes('holy_day_lotus'), false, 'Disabled holyDayMarkers must not show lotus on holy day');
  assert.equal(disabledHolyHtmlEn.includes('Buddhist Holy Day'), false, 'Disabled holyDayMarkers must not show Buddhist Holy Day text');

  dateModal.open('2026-09-26', [], true);
  const disabledHolyHtmlKm = dateModal.overlay.innerHTML;
  assert.equal(disabledHolyHtmlKm.includes('holy_day_lotus'), false, 'Disabled holyDayMarkers must not show lotus on holy day');
  assert.equal(disabledHolyHtmlKm.includes('ថ្ងៃសីល'), false, 'Disabled holyDayMarkers must not show ថ្ងៃសីល text');

  dateModal.close();

  // Cleanup settings
  Storage.saveSettings(DEFAULT_SETTINGS);
});

test('showWesternZodiac setting defaults to true and toggles zodiac visibility in dialogs', async () => {
  const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');
  const { DateDetailsDialogModal, EventDetailsDialogModal } = await server.ssrLoadModule('/src/ui/Modals.ts');
  const { EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');

  assert.equal(DEFAULT_SETTINGS.showWesternZodiac, true, 'Default settings must have showWesternZodiac on');

  const dateModal = new DateDetailsDialogModal(() => {}, () => {});
  const eventModal = new EventDetailsDialogModal(() => {}, () => {});
  const event = EventRepository.getYearEvents(2026).find(e => e.date === '2026-09-24');
  const pastDate = '2025-09-24'; // Fixed past date: its hour and rising sign need a selected time.

  // Default / on: Western zodiac is visible
  Storage.saveSettings({ ...DEFAULT_SETTINGS, showWesternZodiac: true });
  dateModal.open(pastDate, [], false);
  assert.ok(dateModal.overlay.innerHTML.includes('dialog-watermark-western'), 'Western watermark should show when showWesternZodiac is true');
  assert.ok(dateModal.overlay.innerHTML.includes('western-zodiac-table'), 'Western zodiac Big 3 table should show when showWesternZodiac is true');
  assert.ok(dateModal.overlay.innerHTML.includes('Big 3'), 'Big 3 heading should show in English');
  assert.ok(dateModal.overlay.innerHTML.includes('Sun'), 'Sun column should show');
  assert.ok(dateModal.overlay.innerHTML.includes('Moon'), 'Moon column should show');
  assert.ok(dateModal.overlay.innerHTML.includes('Libra'), 'Western zodiac label should show when showWesternZodiac is true');
  assert.ok(dateModal.overlay.innerHTML.includes('Wednesday, September 24, 2025'), 'Selected date is the dialog title');
  assert.ok(dateModal.overlay.innerHTML.includes('ganzhi-table'), 'Ganzhi table is visible by default');
  assert.ok(dateModal.overlay.innerHTML.includes('Clash'), 'Ganzhi clash row is visible');
  assert.match(dateModal.overlay.innerHTML, /<td class="highlight-cell"><span title="[^"]*">Libra<\/span><\/td>/, 'Sun sign cell has highlight-cell class');
  assert.match(dateModal.overlay.innerHTML, /<tr><th scope="row">Sign<\/th><td class="highlight-cell">/u, 'Ganzhi Year sign cell has highlight-cell class');
  assert.ok(dateModal.overlay.innerHTML.includes('scope="col">Hour'), 'Past dates show the hour pillar column header');
  assert.ok(dateModal.overlay.innerHTML.includes('scope="col">Rising sign'), 'Past dates show the rising sign column header');
  assert.ok(dateModal.overlay.innerHTML.includes('class="btn-time-pick"'), 'Uncomputed past values display time pick button');
  assert.ok(dateModal.overlay.innerHTML.includes('>🕒</button>'), 'Uncomputed past values display 🕒 compact button');
  assert.match(dateModal.overlay.innerHTML, /<div class="date-details-header-badge">\s*<button type="button" class="btn-time-pick"/u, 'Header also offers time selection before a time is set');

  // Test setting custom time on not-today date
  dateModal.setTime('14:30');
  assert.ok(dateModal.overlay.innerHTML.includes('btn-time-chip'), 'Setting custom time displays header time chip');
  assert.ok(dateModal.overlay.innerHTML.includes('14:30'), 'Header time chip shows set time');
  assert.ok(dateModal.overlay.innerHTML.includes('time-interactive-cell'), 'Computed columns become interactive cells');
  assert.ok(dateModal.overlay.innerHTML.includes('Aquarius'), 'Rising sign for 2025-09-24 14:30 is computed as Aquarius');
  assert.ok(dateModal.overlay.innerHTML.includes('Goat') || dateModal.overlay.innerHTML.includes('Sheep'), 'Hour pillar animal for 14:30 is Goat/Sheep');
  assert.equal(dateModal.overlay.innerHTML.includes('btn-time-pick'), false, 'Time pick buttons are replaced when time is set');

  // Test clearing custom time reverts to 🕒 button
  dateModal.setTime(null);
  assert.equal(dateModal.overlay.innerHTML.includes('btn-time-chip'), false, 'Clearing time removes header time chip');
  assert.match(dateModal.overlay.innerHTML, /<div class="date-details-header-badge"><button type="button" class="btn-time-pick"/u, 'Clearing time restores the header picker');
  assert.ok(dateModal.overlay.innerHTML.includes('class="btn-time-pick"'), 'Reverts back to time pick button');
  assert.ok(dateModal.overlay.innerHTML.includes('>🕒</button>'), 'Reverts back to 🕒 compact button');

  dateModal.open(pastDate, [], true);
  assert.equal((dateModal.overlay.innerHTML.match(/September 24, 2025/g) || []).length, 1, 'Khmer date details have one Gregorian date title');
  assert.ok(dateModal.overlay.innerHTML.includes('Libra'), 'Western zodiac displays English name in Khmer mode');
  assert.ok(dateModal.overlay.innerHTML.includes('ព្រះអាទិត្យ'), 'Sun header in Khmer');
  assert.ok(dateModal.overlay.innerHTML.includes('ព្រះច័ន្ទ'), 'Moon header in Khmer');
  assert.ok(dateModal.overlay.innerHTML.includes('ម៉ោង'), 'Hour header in Khmer');
  assert.ok(dateModal.overlay.innerHTML.includes('រះ'), 'Rising sign header in Khmer');

  const { todayInZone, dateTimeInZone } = await server.ssrLoadModule('/src/domain/DateTime.ts');
  const todayStr = todayInZone(DEFAULT_SETTINGS.todayTimeZone);
  const timeBeforeOpen = dateTimeInZone(new Date(), DEFAULT_SETTINGS.todayTimeZone).time;
  dateModal.open(todayStr, [], true);
  const timeAfterOpen = dateTimeInZone(new Date(), DEFAULT_SETTINGS.todayTimeZone).time;
  assert.ok(dateModal.overlay.innerHTML.includes('រះ'), 'Rising sign column header displays រះ in Khmer mode');
  assert.ok([timeBeforeOpen, timeAfterOpen].some(time => dateModal.overlay.innerHTML.includes(`<span class="btn-time-chip-text">${time}</span>`)), 'Today opens with the current time in an editable chip');
  assert.ok(dateModal.overlay.innerHTML.includes('time-interactive-cell'), 'Today hour and rising sign cells can open the time picker');
  assert.equal(dateModal.overlay.innerHTML.includes('date-details-today-badge'), false, 'The Today badge is replaced by the editable time chip');

  dateModal.setTime('14:30');
  assert.ok(dateModal.overlay.innerHTML.includes('<span class="btn-time-chip-text">14:30</span>'), 'Today keeps a manually selected time');
  dateModal.setTime(null);
  assert.equal(dateModal.overlay.innerHTML.includes('btn-time-chip'), false, 'Clearing Today removes the time chip');
  assert.match(dateModal.overlay.innerHTML, /<div class="date-details-header-badge"><button type="button" class="btn-time-pick"/u, 'Clearing Today restores the header picker');
  assert.ok(dateModal.overlay.innerHTML.includes('btn-time-pick'), 'Clearing Today restores the time picker buttons');
  dateModal.open(todayStr, [], true);
  assert.ok(dateModal.overlay.innerHTML.includes('btn-time-chip'), 'Reopening Today selects the current time again');

  eventModal.open(event, false);
  assert.ok(eventModal.overlay.innerHTML.includes('dialog-watermark-western'), 'Event details watermark should show when showWesternZodiac is true');

  // Off / false: Western zodiac is hidden
  Storage.saveSettings({ ...DEFAULT_SETTINGS, showWesternZodiac: false });
  dateModal.open(pastDate, [], false);
  assert.equal(dateModal.overlay.innerHTML.includes('dialog-watermark-western'), false, 'Western watermark should be hidden when showWesternZodiac is false');
  assert.equal(dateModal.overlay.innerHTML.includes('western-zodiac-table'), false, 'Western zodiac table should be hidden when showWesternZodiac is false');

  dateModal.open('1800-09-24', [], false);
  assert.ok(dateModal.overlay.innerHTML.includes('ganzhi-range-note'), 'Ganzhi solar year and month are marked unavailable outside 1900–2100');
  assert.match(dateModal.overlay.innerHTML, /<div class="date-details-header-badge">\s*<button type="button" class="btn-time-pick"/u, 'Ganzhi hour remains selectable outside the solar pillar range');
  dateModal.setTime('14:30');
  assert.ok(dateModal.overlay.innerHTML.includes('time-interactive-cell'), 'Selected Ganzhi hour is computed and editable outside the solar pillar range');

  Storage.saveSettings({ ...DEFAULT_SETTINGS, showWesternZodiac: false, showGanzhi: false });
  const { Zodiac } = await server.ssrLoadModule('/src/domain/Zodiac.ts');
  const originalSignLookup = Zodiac.forMonthDay;
  const originalWesternDrawable = Zodiac.getWesternDrawable;
  Zodiac.forMonthDay = () => { throw new Error('Disabled Western sign lookup ran'); };
  Zodiac.getWesternDrawable = () => { throw new Error('Disabled Western watermark lookup ran'); };
  try {
    dateModal.open(pastDate, [], false);
    assert.match(dateModal.overlay.innerHTML, /<div class="date-details-header-badge">\s*<\/div>/u, 'Header omits time picker when both time-dependent tables are hidden');
    dateModal.open(todayStr, [], false);
    assert.match(dateModal.overlay.innerHTML, /<div class="date-details-header-badge">\s*<\/div>/u, 'Today header omits its automatic time chip when both tables are hidden');
    assert.equal(dateModal.timePickerModal, undefined, 'Hidden time picker is not constructed');

    eventModal.open(event, false);
    assert.equal(eventModal.overlay.innerHTML.includes('dialog-watermark-western'), false, 'Event details watermark should be hidden when showWesternZodiac is false');
  } finally {
    Zodiac.forMonthDay = originalSignLookup;
    Zodiac.getWesternDrawable = originalWesternDrawable;
  }

  // Emoji toggle for Western Zodiac
  Storage.saveSettings({ ...DEFAULT_SETTINGS, showWesternZodiac: true, useEmojiForWesternZodiac: true });
  dateModal.open(pastDate, [], false);
  assert.ok(dateModal.overlay.innerHTML.includes('western-zodiac-table'), 'Western zodiac table should show');
  assert.match(dateModal.overlay.innerHTML, /<span title="Libra">♎️?<\/span>/u, 'Should show Libra emoji with name tooltip');

  Storage.saveSettings({ ...DEFAULT_SETTINGS, showGanzhi: false });
  dateModal.open(pastDate, [], false);
  assert.equal(dateModal.overlay.innerHTML.includes('ganzhi-table-wrap'), false, 'Ganzhi setting hides its table');

  Storage.saveSettings({ ...DEFAULT_SETTINGS, useEmojiForGanzhiAnimals: true });
  dateModal.open(pastDate, [], false);
  assert.match(dateModal.overlay.innerHTML, /<span title="[^"]+">[🐭🐮🐯🐰🐲🐍🐴🐐🐵🐔🐶🐷]<\/span>/u);

  dateModal.close();

  // Test TimePickerModal
  const { TimePickerModal } = await server.ssrLoadModule('/src/ui/Modals.ts');
  let pickedTime = null;
  const timePicker = new TimePickerModal((t) => { pickedTime = t; });
  timePicker.open('09:15', false, 'Asia/Phnom_Penh');
  assert.ok(timePicker.overlay.innerHTML.includes('time-picker-dialog'), 'Time picker dialog renders');
  assert.ok(timePicker.overlay.innerHTML.includes('09:15'), 'Initial time value is populated');
  assert.ok(timePicker.overlay.innerHTML.includes('btn-time-clear'), 'Clear button is visible when initial time is set');
  assert.ok(timePicker.overlay.innerHTML.includes('btn-time-save'), 'Save button is visible');
  assert.ok(timePicker.overlay.innerHTML.includes('btn-time-cancel'), 'Cancel button is visible');
  timePicker.close();

  // Test when initialTime is null
  timePicker.open(null, true, 'Asia/Phnom_Penh');
  assert.equal(timePicker.overlay.innerHTML.includes('btn-time-clear'), false, 'Clear button is hidden when no initial time');
  timePicker.close();

  // Cleanup settings
  Storage.saveSettings(DEFAULT_SETTINGS);
});
