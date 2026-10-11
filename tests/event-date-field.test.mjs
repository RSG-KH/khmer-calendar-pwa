import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { eventDateCells } = await server.ssrLoadModule('/src/ui/EventDateField.ts');
const { CalendarWords } = await server.ssrLoadModule('/src/data/i18n.ts');

test('date picker grids align weekdays and cover leap days and supported range endpoints', () => {
  const sunday = eventDateCells(2026, 2, false);
  assert.equal(sunday[0], '2026-02-01');
  assert.equal(sunday.length, 28);
  const monday = eventDateCells(2026, 2, true);
  assert.deepEqual(monday.slice(0, 6), Array(6).fill(null));
  assert.equal(monday[6], '2026-02-01');
  assert.equal(monday.length, 35);
  for (const [year, month, lastDay] of [[2000, 2, 29], [2100, 2, 28], [1800, 1, 31], [2200, 12, 31]]) {
    const cells = eventDateCells(year, month, false).filter(Boolean);
    assert.equal(cells.length, lastDay);
    assert.equal(cells.at(-1), `${year}-${String(month).padStart(2, '0')}-${lastDay}`);
  }
});

test('compact Khmer lunar labels retain the phase and English stays unchanged', () => {
  assert.equal(CalendarWords.lunarCompact(15, true, true), '១៥ ក');
  assert.equal(CalendarWords.lunarCompact(14, false, true), '១៤ រ');
  assert.equal(CalendarWords.lunarCompact(15, true, false), CalendarWords.lunarShort(15, true, false));
  assert.equal(new Set(Array.from({ length: 7 }, (_, day) => CalendarWords.weekday(day, true, 'short'))).size, 7);
});
