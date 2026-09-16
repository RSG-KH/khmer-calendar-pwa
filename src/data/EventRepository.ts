// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import rawEvents from './events.json';
import { RecurringEvents } from './RecurringEvents';
import { eventCoverage, hasCapturedYear } from './EventCoverage';
import { bundledEventYear } from './BundledEventDates';
import { KhmerCalendar, toEpochDay, fromEpochDay } from '../domain/KhmerCalendar';
import { L } from './i18n';
import { Storage } from './Storage';

export type EventKind = 'HOLIDAY' | 'OBSERVANCE' | 'HOLY_DAY' | 'CUSTOM';
export type DateBasis = 'captured' | 'calculated' | 'khmer_lunar' | 'custom';

export interface CalendarEvent {
  id: string;
  date: string; // 'YYYY-MM-DD'
  titleKm: string;
  titleEn: string;
  kind: EventKind;
  basis: DateBasis;
  officialSourceUrl?: string | null;
  time?: string;
  notes?: string;
  instant?: string;
}

export class EventRepository {
  private static bundledEvents: CalendarEvent[] = (rawEvents as any[]).map(e => ({
    id: e.id,
    date: e.date,
    titleKm: e.km,
    titleEn: e.en,
    kind: e.kind as EventKind,
    basis: 'captured',
    officialSourceUrl: e.url || null
  }));

  private static yearCache = new Map<number, CalendarEvent[]>();

  static hasBundledYear(year: number): boolean {
    return year >= eventCoverage.fromYear && year <= eventCoverage.throughYear;
  }

  static getYearEvents(year: number): CalendarEvent[] {
    if (!Number.isInteger(year) || year < KhmerCalendar.minYear || year > KhmerCalendar.maxYear) {
      throw new RangeError('Supported years: 1800–2200.');
    }
    if (this.yearCache.has(year)) {
      return this.yearCache.get(year)!;
    }

    const events: CalendarEvent[] = [];
    const bundled = bundledEventYear(year);

    if (hasCapturedYear(year)) {
      const prefix = `${year}-`;
      for (const e of this.bundledEvents) {
        if (e.date.startsWith(prefix)) {
          events.push(e);
        }
      }
    } else {
      const calculated = bundled ? RecurringEvents.fromDates(year, bundled.recurrences) : RecurringEvents.forYear(year);
      for (const c of calculated) {
        events.push({
          id: c.id,
          date: c.date,
          titleKm: c.km,
          titleEn: c.en,
          kind: 'OBSERVANCE',
          basis: 'calculated'
        });
      }
    }

    // Cached years avoid the daily scan, including captured snapshot years.
    const holyDays = bundled?.holyDays ?? this.calculateHolyDays(year);
    for (const date of holyDays) {
      events.push({
        id: `sil:${date}`, date,
        titleKm: L.text('event.holy_day', true), titleEn: L.text('event.holy_day', false),
        kind: 'HOLY_DAY', basis: 'khmer_lunar'
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    this.yearCache.set(year, events);
    return events;
  }

  private static calculateHolyDays(year: number): string[] {
    const dates: string[] = [];
    const startEpoch = toEpochDay(year, 1, 1);
    const endEpoch = toEpochDay(year, 12, 31);
    for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
      const { year: dy, month: dm, day: dd } = fromEpochDay(epoch);
      const lunar = KhmerCalendar.fromGregorian(dy, dm, dd);
      if (lunar.isHolyDay) {
        const dateStr = `${dy}-${String(dm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        dates.push(dateStr);
      }
    }

    return dates;
  }

  static forMonth(year: number, month: number): CalendarEvent[] {
    const yearEvents = this.getYearEvents(year);
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    const filtered = yearEvents.filter(e => e.date.startsWith(monthPrefix));

    // Merge custom events
    const custom = Storage.getCustomEvents();
    for (const c of custom) {
      if (c.date.startsWith(monthPrefix)) {
        filtered.push({
          id: c.id,
          date: c.date,
          titleKm: c.title,
          titleEn: c.title,
          kind: 'CUSTOM',
          basis: 'custom',
          time: c.time,
          notes: c.notes,
          instant: c.instant
        });
      }
    }

    return filtered.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    });
  }

  static forDate(dateStr: string): CalendarEvent[] {
    const parts = dateStr.split('-').map(Number);
    const monthEvents = this.forMonth(parts[0], parts[1]);
    return monthEvents.filter(e => e.date === dateStr);
  }

  static forYearWithCustom(year: number): CalendarEvent[] {
    const yearEvents = [...this.getYearEvents(year)];
    const prefix = `${year}-`;
    const custom = Storage.getCustomEvents();
    for (const c of custom) {
      if (c.date.startsWith(prefix)) {
        yearEvents.push({
          id: c.id,
          date: c.date,
          titleKm: c.title,
          titleEn: c.title,
          kind: 'CUSTOM',
          basis: 'custom',
          time: c.time,
          notes: c.notes,
          instant: c.instant
        });
      }
    }
    return yearEvents.sort((a, b) => a.date.localeCompare(b.date));
  }
}
