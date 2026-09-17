// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { isSupportedDate } from './DateTime';

export type RepeatFrequency = 'days' | 'weekly' | 'monthly' | 'yearly';
export interface EventRepeat {
  frequency: RepeatFrequency;
  until: string;
  interval?: number;
  includeThirty?: boolean;
  includeFebruary?: boolean;
  timeZone: string;
}

const dayMs = 86_400_000;
const epoch = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);

export function validRepeat(start: string, repeat: EventRepeat): boolean {
  return isSupportedDate(start) && isSupportedDate(repeat.until) && repeat.until >= start
    && ['days', 'weekly', 'monthly', 'yearly'].includes(repeat.frequency)
    && (repeat.frequency !== 'days' || (Number.isSafeInteger(repeat.interval) && repeat.interval! > 0));
}

/** Work in civil dates and always advance from the original anchor, never a fallback. */
export function repeatDates(start: string, repeat: EventRepeat, from = start, through = repeat.until) {
  const result = { dates: [] as string[], skipped: [] as string[], affectsThirty: false, affectsFebruary: false };
  if (!validRepeat(start, repeat) || !isSupportedDate(from) || !isSupportedDate(through)) return result;
  const first = from > start ? from : start;
  const last = through < repeat.until ? through : repeat.until;
  if (first > last) return result;
  const anchor = epoch(start);
  if (repeat.frequency === 'days' || repeat.frequency === 'weekly') {
    const step = repeat.frequency === 'weekly' ? 7 : repeat.interval!;
    const offset = Math.ceil((epoch(first) - anchor) / dayMs / step) * step;
    const limit = (epoch(last) - anchor) / dayMs;
    for (let day = offset; day <= limit; day += step) result.dates.push(iso(anchor + day * dayMs));
    return result;
  }
  const [year, month, day] = start.split('-').map(Number);
  const [firstYear, firstMonth] = first.split('-').map(Number);
  const [lastYear, lastMonth] = last.split('-').map(Number);
  const add = (y: number, m: number) => {
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const date = iso(Date.UTC(y, m - 1, Math.min(day, daysInMonth)));
    // A fallback only matters if its actual date falls inside the chosen range.
    if (date < first || date > last) return;
    if (day > daysInMonth) {
      if (m === 2) result.affectsFebruary = true;
      else result.affectsThirty = true;
      if (!(m === 2 ? repeat.includeFebruary : repeat.includeThirty)) {
        result.skipped.push(date);
        return;
      }
    }
    result.dates.push(date);
  };
  if (repeat.frequency === 'monthly') {
    for (let index = firstYear * 12 + firstMonth - 1; index <= lastYear * 12 + lastMonth - 1; index++) {
      add(Math.floor(index / 12), index % 12 + 1);
    }
  } else {
    for (let y = Math.max(year, firstYear); y <= lastYear; y++) add(y, month);
  }
  return result;
}

/** Include neighboring source dates when a timed series is viewed in another zone. */
export function paddedDateRange(from: string, through: string): [string, string] {
  return [iso(Math.max(epoch('1800-01-01'), epoch(from) - 2 * dayMs)),
    iso(Math.min(epoch('2200-12-31'), epoch(through) + 2 * dayMs))];
}
