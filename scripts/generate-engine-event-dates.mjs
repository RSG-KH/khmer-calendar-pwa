// Copyright (c) 2026 RSG-KH | Apache-2.0 License
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Load the same app adapters used at runtime, never the existing cache.
async function generateEventDates() {
  const server = await createServer({
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  try {
    const { RecurringEvents } = await server.ssrLoadModule('/src/data/RecurringEvents.ts');
    const { calendarEngine, toEpochDay, fromEpochDay } = await server.ssrLoadModule('/src/domain/KhmerCalendar.ts');
    const { eventCoverage, hasCapturedYear } = await server.ssrLoadModule('/src/data/EventCoverage.ts');
    const years = {};
    for (let year = eventCoverage.fromYear; year <= eventCoverage.throughYear; year++) {
      const dates = { sil: [] };
      for (let epoch = toEpochDay(year, 1, 1); epoch <= toEpochDay(year, 12, 31); epoch++) {
        const d = fromEpochDay(epoch);
        const result = calendarEngine.fromGregorian(d.year, d.month, d.day);
        if (result.lunar.isHolyDay) dates.sil.push(result.date.iso.slice(5));
      }
      if (!hasCapturedYear(year)) {
        for (const entry of RecurringEvents.dates(year)) {
          dates[`calculated:${entry.rule.id}`] = entry.dates.map(date => date.slice(5));
        }
      }
      years[year] = dates;
    }
    // Hash JSON content, independent of checkout line endings or indentation.
    const rules = JSON.stringify(JSON.parse(await readFile(new URL('../src/data/recurrence-rules.json', import.meta.url), 'utf8')));
    return {
      schema: 1, engineVersion: calendarEngine.version,
      rulesSha256: createHash('sha256').update(rules).digest('hex'), ...eventCoverage, years
    };
  } finally { await server.close(); }
}

const generated = JSON.stringify(await generateEventDates()) + '\n';
const output = new URL('../src/data/engine-event-dates.json', import.meta.url);
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')).replace(/\r\n/g, '\n') !== generated) {
    throw new Error('Engine event cache is stale. Run npm run generate:events and review the changes.');
  }
  console.log('Engine event cache matches the pinned engine and recurrence definitions.');
} else {
  await writeFile(output, generated);
  console.log('Generated 1980–2050 engine event dates.');
}
