import rawCache from './engine-event-dates.json';
import { eventCoverage, hasCapturedYear } from './EventCoverage';
import { recurrenceRules, type RuleDates } from './RecurringEvents';
import { calendarEngine } from '../domain/KhmerCalendar';
import { isSupportedDate } from '../domain/DateTime';

type YearDates = Record<string, string[]>;
interface EventDateCache {
  schema: number;
  engineVersion: string;
  rulesSha256: string;
  fromYear: number;
  throughYear: number;
  capturedFromYear: number;
  capturedThroughYear: number;
  years: Record<string, YearDates>;
}

export function validateEventCache(cache: EventDateCache): void {
  if (cache.schema !== 1 || cache.engineVersion !== calendarEngine.version
    || Object.entries(eventCoverage).some(([key, value]) => cache[key as keyof typeof eventCoverage] !== value)
    || !/^[a-f0-9]{64}$/.test(cache.rulesSha256)
    || Object.keys(cache.years).length !== eventCoverage.throughYear - eventCoverage.fromYear + 1) {
    throw new Error('Invalid engine event cache metadata');
  }
  for (let year = cache.fromYear; year <= cache.throughYear; year++) {
    if (!cache.years[year]) throw new Error(`Missing cached event year: ${year}`);
  }
}

export function decodeEventYear(year: number, entries: YearDates): { holyDays: string[]; recurrences: RuleDates[] } {
  const active = hasCapturedYear(year) ? [] : recurrenceRules.filter(rule => year >= rule.fromYear && year <= rule.throughYear);
  const expected = new Set(['sil', ...active.map(rule => `calculated:${rule.id}`)]);
  if (Object.keys(entries).length !== expected.size || Object.keys(entries).some(id => !expected.has(id))) {
    throw new Error(`Invalid cached event IDs: ${year}`);
  }
  const decoded = new Map<string, string[]>();
  for (const id of expected) {
    const dates = entries[id];
    if (!Array.isArray(dates) || !dates.length || new Set(dates).size !== dates.length
      || dates.some(date => !/^\d{2}-\d{2}$/.test(date) || !isSupportedDate(`${year}-${date}`))) {
      throw new Error(`Invalid cached dates: ${id}, ${year}`);
    }
    decoded.set(id, dates.map(date => `${year}-${date}`));
  }
  return {
    holyDays: decoded.get('sil')!,
    recurrences: active.map(rule => ({ rule, dates: decoded.get(`calculated:${rule.id}`)! }))
  };
}

validateEventCache(rawCache);

export function bundledEventYear(year: number) {
  const entries = (rawCache.years as Record<string, YearDates>)[year];
  return entries ? decodeEventYear(year, entries) : undefined;
}
