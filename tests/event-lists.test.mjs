import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { compareCalendarEvents, EventRepository } = await server.ssrLoadModule('/src/data/EventRepository.ts');
const { renderEventRows } = await server.ssrLoadModule('/src/ui/EventRows.ts');
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};
beforeEach(() => storage.clear());

const event = (id, kind, time, date = '2026-09-24') => ({ id, kind, time, date, titleEn: id, titleKm: id, basis: 'custom' });

test('dates remain chronological, with timed personal events, untimed personal events, holidays, observances and holy days in each day', () => {
  const events = [
    event('holy', 'HOLY_DAY'), event('observance', 'OBSERVANCE'), event('holiday', 'HOLIDAY'),
    event('untimed', 'CUSTOM'), event('last-minute', 'CUSTOM', '23:59'),
    event('morning', 'CUSTOM', '09:00'), event('midnight', 'CUSTOM', '00:00'),
    event('next-day', 'CUSTOM', '00:00', '2026-09-25'),
    event('previous-day', 'OBSERVANCE', undefined, '2026-09-23')
  ];
  assert.deepEqual(events.sort(compareCalendarEvents).map(e => e.id), [
    'previous-day', 'midnight', 'morning', 'last-minute', 'untimed', 'holiday', 'observance', 'holy', 'next-day'
  ]);
});

test('personal events with equal times or no times preserve saved order', () => {
  const events = [event('z-untimed', 'CUSTOM'), event('z-first', 'CUSTOM', '12:00'),
    event('a-second', 'CUSTOM', '12:00'), event('a-untimed', 'CUSTOM')];
  assert.deepEqual(events.sort(compareCalendarEvents).map(e => e.id), ['z-first', 'a-second', 'z-untimed', 'a-untimed']);
});

test('date, month and year queries share ordering after recurrence and time-zone conversion', () => {
  storage.set('khmer_calendar_settings', JSON.stringify({ todayTimeZone: 'cambodia' }));
  storage.set('khmer_calendar_custom_events', JSON.stringify([
    { id: 'untimed', title: 'Untimed', date: '2026-09-24' },
    { id: 'late', title: 'Late', date: '2026-09-24', time: '23:00' },
    { id: 'series', title: 'Daily', date: '2026-09-23', time: '08:00', repeat: { frequency: 'days', interval: 1, until: '2026-09-25', timeZone: 'Asia/Phnom_Penh' } },
    { id: 'converted', title: 'Converted', date: '2026-09-23', time: '23:00', instant: '2026-09-23T23:00:00Z' }
  ]));
  const cached = EventRepository.getYearEvents(2026).map(e => `${e.id}:${e.date}`);
  const day = EventRepository.forDate('2026-09-24');
  assert.deepEqual(day.filter(e => e.kind === 'CUSTOM').map(e => [e.id, e.time]), [
    ['converted', '06:00'], ['series@2026-09-24', '08:00'], ['late', '23:00'], ['untimed', undefined]
  ]);
  assert.equal(day[4].kind, 'HOLIDAY');
  for (const events of [EventRepository.forMonth(2026, 9), EventRepository.forYearWithCustom(2026)]) {
    assert.deepEqual(events.filter(e => e.date === '2026-09-24'), day);
  }
  assert.deepEqual(EventRepository.getYearEvents(2026).map(e => `${e.id}:${e.date}`), cached);
});

test('grouped rows label each date once, retain holiday coloring, and give every button its date', () => {
  const events = [event('personal', 'CUSTOM', '09:00'), event('holiday', 'HOLIDAY'),
    event('observance', 'OBSERVANCE'), event('tomorrow', 'CUSTOM', undefined, '2026-09-25')];
  const html = renderEventRows(events, false);
  assert.equal((html.match(/class="event-day-group"/g) ?? []).length, 2);
  assert.equal((html.match(/class="event-row-daynum/g) ?? []).length, 2);
  assert.equal((html.match(/class="event-row-weekday"/g) ?? []).length, 2);
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g);
  assert.equal(buttons.length, 4);
  assert.match(buttons[0], /class="event-row-daynum holiday">24</);
  for (const button of buttons.slice(1, 3)) {
    assert.match(button, /class="event-row-date" aria-hidden="true"><\/div>/);
    assert.match(button, /aria-label="[^"\n]*September[^"\n]*2026/);
  }
  const filtered = renderEventRows(events.filter(e => e.kind === 'OBSERVANCE'), false);
  assert.match(filtered, /class="event-row-daynum">24</);
  assert.equal(renderEventRows([], false), '');
});

test('Khmer grouped rows retain localized dates and escape personal-event text and attributes', () => {
  const html = renderEventRows([event('A "title" <script> &', 'CUSTOM')], true);
  assert.match(html, /class="event-row-daynum custom">២៤</);
  assert.match(html, /A &quot;title&quot; &lt;script&gt; &amp;/);
  assert.equal(html.includes('<script>'), false);
});

test('holy-day rows use the bud on the eighth lunar day and blossom at the end of the fortnight', () => {
  const html = renderEventRows([
    event('eighth-day', 'HOLY_DAY', undefined, '2026-09-05'),
    event('fortnight-end', 'HOLY_DAY', undefined, '2026-09-11'),
    event('personal', 'CUSTOM', undefined, '2026-09-11'),
    event('observance', 'OBSERVANCE', undefined, '2026-09-11')
  ], false);
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g);
  assert.match(buttons[0], /holy-day-event-row/);
  assert.match(buttons[0], /assets\/drawables\/holy_day_lotus\.png/);
  assert.match(buttons[1], /holy-day-event-row/);
  assert.match(buttons[1], /assets\/drawables\/holy_day_lotus_blossom\.png/);
  assert.match(buttons[2], /custom-event-row/);
  for (const button of buttons.slice(2)) assert.doesNotMatch(button, /holy-day-event-row|event-lotus-image/);
});

test('monthly events heading is scoped to calendar-month-events-header and hidden in portrait mode', async () => {
  const mainTs = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /<div class="calendar-month-events-header"[^>]*>[\s\S]*?ui\.all_events_in_month/);

  const responsiveCss = await readFile(new URL('../src/styles/responsive.css', import.meta.url), 'utf8');
  assert.match(responsiveCss, /@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.calendar-month-events-header\s*\{\s*display:\s*none;\s*\}[\s\S]*?\}/);
  assert.doesNotMatch(responsiveCss, /@media\s*\(orientation:\s*landscape\)\s*\{[\s\S]*?\.calendar-month-events-header\s*\{\s*display:\s*none;\s*\}[\s\S]*?\}/);
});

test('date details dialog event buttons have visual gap between title and event kind', async () => {
  const modalsTs = await readFile(new URL('../src/ui/Modals.ts', import.meta.url), 'utf8');
  assert.match(modalsTs, /class="dialog-event-content"\s+style="[^"]*gap:\s*3px/);

  const appearanceCss = await readFile(new URL('../src/styles/appearance.css', import.meta.url), 'utf8');
  assert.match(appearanceCss, /\.dialog-event-content\s*\{[^}]*gap:\s*3px/);
  assert.match(appearanceCss, /\.dialog-event-title\s*\{[^}]*line-height:\s*1\.4/);
  assert.match(appearanceCss, /\.dialog-event-kind\s*\{[^}]*line-height:\s*1\.3/);
});

test('modal overlay background dim is 30% for light theme and increased to 55% for dark theme', async () => {
  const themeCss = await readFile(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
  assert.match(themeCss, /:root\s*\{[\s\S]*?--modal-scrim:\s*rgba\(0,\s*0,\s*0,\s*0\.3\);/);
  assert.match(themeCss, /\[data-theme="dark"\]\s*\{[\s\S]*?--modal-scrim:\s*rgba\(0,\s*0,\s*0,\s*0\.55\);/);

  const appearanceCss = await readFile(new URL('../src/styles/appearance.css', import.meta.url), 'utf8');
  assert.match(appearanceCss, /:root\s*\{[\s\S]*?--modal-scrim:\s*rgba\(0,\s*0,\s*0,\s*0\.3\);/);
  assert.match(appearanceCss, /\[data-theme="dark"\]\s*\{[\s\S]*?--modal-scrim:\s*rgba\(0,\s*0,\s*0,\s*0\.55\);/);
  assert.match(appearanceCss, /\.modal-overlay\s*\{[^}]*background:\s*var\(--modal-scrim,\s*rgba\(0,\s*0,\s*0,\s*0\.3\)\);/);
});

test('engine calculation attributions in event details and astrology popups use 10px font size', async () => {
  const modalsTs = await readFile(new URL('../src/ui/Modals.ts', import.meta.url), 'utf8');
  assert.match(modalsTs, /isEngineCalculated\s*\?\s*'10px'\s*:\s*'13px'/);

  const appearanceCss = await readFile(new URL('../src/styles/appearance.css', import.meta.url), 'utf8');
  assert.match(appearanceCss, /\.astrology-engine-attribution\s*\{[^}]*font-size:\s*calc\(10px\s*\*\s*var\(--font-scale\)\);/);
});

test('event details popup footer has 30px gap before action buttons matching other popups', async () => {
  const modalsTs = await readFile(new URL('../src/ui/Modals.ts', import.meta.url), 'utf8');
  assert.match(modalsTs, /class="event-detail-footer"[^>]*margin-top:\s*30px/);

  const appearanceCss = await readFile(new URL('../src/styles/appearance.css', import.meta.url), 'utf8');
  assert.match(appearanceCss, /\.event-detail-footer\s*\{[^}]*margin-top:\s*30px;/);
});

test('date details subtitles and event details categories follow event type colors', async () => {
  const appearanceCss = await readFile(new URL('../src/styles/appearance.css', import.meta.url), 'utf8');
  const componentsCss = await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8');
  const modalsTs = await readFile(new URL('../src/ui/Modals.ts', import.meta.url), 'utf8');

  // Verify date details subtitle colors
  assert.match(appearanceCss, /\.dialog-event-kind\.holiday\s*\{\s*color:\s*var\(--tertiary\);\s*\}/);
  assert.match(appearanceCss, /\.dialog-event-kind\.holy_day\s*\{\s*color:\s*var\(--secondary\);\s*\}/);
  assert.match(appearanceCss, /\.dialog-event-kind\.observance\s*\{\s*color:\s*var\(--accent\);\s*\}/);
  assert.match(appearanceCss, /\.dialog-event-kind\.custom\s*\{\s*color:\s*#E53935;\s*\}/);

  assert.match(componentsCss, /\.dialog-event-kind\.holiday\s*\{\s*color:\s*var\(--tertiary\);\s*\}/);
  assert.match(componentsCss, /\.dialog-event-kind\.holy_day\s*\{\s*color:\s*var\(--secondary\);\s*\}/);
  assert.match(componentsCss, /\.dialog-event-kind\.observance\s*\{\s*color:\s*var\(--accent\);\s*\}/);
  assert.match(componentsCss, /\.dialog-event-kind\.custom\s*\{\s*color:\s*#E53935;\s*\}/);

  // Verify Modals.ts renders dialog-event-kind with event kind class
  assert.match(modalsTs, /class="dialog-event-kind \$\{e\.kind\.toLowerCase\(\)\}"/);

  // Verify event details category colors
  assert.match(appearanceCss, /\.event-detail-category\.holiday\s*\{\s*color:\s*var\(--tertiary\);\s*\}/);
  assert.match(appearanceCss, /\.event-detail-category\.holy_day\s*\{\s*color:\s*var\(--secondary\);\s*\}/);
  assert.match(appearanceCss, /\.event-detail-category\.observance\s*\{\s*color:\s*var\(--accent\);\s*\}/);
  assert.match(appearanceCss, /\.event-detail-category\.custom\s*\{\s*color:\s*#E53935;\s*\}/);

  assert.match(componentsCss, /\.event-detail-category\.holiday\s*\{\s*color:\s*var\(--tertiary\);\s*\}/);
  assert.match(componentsCss, /\.event-detail-category\.holy_day\s*\{\s*color:\s*var\(--secondary\);\s*\}/);
  assert.match(componentsCss, /\.event-detail-category\.observance\s*\{\s*color:\s*var\(--accent\);\s*\}/);
  assert.match(componentsCss, /\.event-detail-category\.custom\s*\{\s*color:\s*#E53935;\s*\}/);

  // Verify Modals.ts renders event-detail-category with event kind class
  assert.match(modalsTs, /class="event-detail-category \$\{event\.kind\.toLowerCase\(\)\}"/);

  // Verify event-detail-title styling
  assert.match(appearanceCss, /\.event-detail-title\s*\{[^}]*color:\s*var\(--accent\);/);
  assert.match(componentsCss, /\.event-detail-title\s*\{[^}]*color:\s*var\(--accent\);/);

  // Verify event-detail-time styling
  assert.match(appearanceCss, /\.event-detail-time\s*\{[^}]*color:\s*#E53935;[^}]*font-weight:\s*500;/);
  assert.match(componentsCss, /\.event-detail-time\s*\{[^}]*color:\s*#E53935;[^}]*font-weight:\s*500;/);
  assert.match(appearanceCss, /\.event-detail-time-block\s*\{[^}]*gap:\s*4px;/);
  assert.match(componentsCss, /\.event-detail-time-block\s*\{[^}]*gap:\s*4px;/);
  assert.match(modalsTs, /class="event-detail-time-block"/);
  assert.match(modalsTs, /class="event-detail-time"/);
});

test('holiday subtitle is formatted as Observance · Holiday and Events tab filter includes holidays in Observances', async () => {
  const { formatEventSubtitle } = await server.ssrLoadModule('/src/ui/EventTime.ts');
  const holidayEvent = event('pchum_ben', 'HOLIDAY');

  assert.equal(formatEventSubtitle(holidayEvent, false, 'cambodia'), 'Observance · Holiday');
  assert.equal(formatEventSubtitle(holidayEvent, true, 'cambodia'), 'ពិធី និងទិវា · ថ្ងៃឈប់សម្រាក');

  // Verify renderEventRows renders Observance · Holiday with holiday class
  const htmlEn = renderEventRows([holidayEvent], false);
  assert.ok(htmlEn.includes('class="event-row-kind holiday"'));
  assert.ok(htmlEn.includes('Observance · Holiday'));

  const htmlKm = renderEventRows([holidayEvent], true);
  assert.ok(htmlKm.includes('class="event-row-kind holiday"'));
  assert.ok(htmlKm.includes('ពិធី និងទិវា · ថ្ងៃឈប់សម្រាក'));

  // Verify main.ts filter logic: filter 1 has HOLIDAY only, filter 2 has both OBSERVANCE and HOLIDAY
  const mainTs = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /if\s*\(this\.eventsFilter === 1 && e\.kind !== 'HOLIDAY'\)\s*return false;/);
  assert.match(mainTs, /if\s*\(this\.eventsFilter === 2 && e\.kind !== 'OBSERVANCE' && e\.kind !== 'HOLIDAY'\)\s*return false;/);
});

test('personal event lists apply personal event color to big day number', async () => {
  const customEvent = event('Meeting', 'CUSTOM');
  const holidayEvent = event('Holiday', 'HOLIDAY');
  const observanceEvent = event('Observance', 'OBSERVANCE');

  const customHtml = renderEventRows([customEvent], false);
  assert.match(customHtml, /class="event-row-daynum custom">24</);

  const holidayHtml = renderEventRows([holidayEvent], false);
  assert.match(holidayHtml, /class="event-row-daynum holiday">24</);

  const mixedHtml = renderEventRows([customEvent, holidayEvent], false);
  assert.match(mixedHtml, /class="event-row-daynum holiday">24</);

  const observanceHtml = renderEventRows([observanceEvent], false);
  assert.match(observanceHtml, /class="event-row-daynum">24</);
  assert.equal(observanceHtml.includes('class="event-row-daynum holiday"'), false);
  assert.equal(observanceHtml.includes('class="event-row-daynum custom"'), false);

  const componentsCss = await readFile(new URL('../src/styles/components.css', import.meta.url), 'utf8');
  assert.match(componentsCss, /\.event-row-daynum\.custom\s*\{\s*color:\s*#E53935;\s*\}/);
});




