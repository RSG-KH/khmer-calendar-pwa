// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { calendarCatalog, eventNames, type CatalogEvent, type CatalogHoliday, type CatalogSource } from './RecurringEvents';
import { KhmerCalendar, calendarEngine, khmerNumber, toEpochDay, fromEpochDay } from '../domain/KhmerCalendar';
import { EventDateOverride, GregorianDate, createRule, type RecurrenceRule as EngineRecurrenceRule } from 'khmer-calendar-engine';
import { L } from './i18n';
import { Storage } from './Storage';
import { customEventOccurrences } from './CustomEventOccurrences';
import type { EventRepeat } from '../domain/EventRepeat';

export type EventKind = 'HOLIDAY' | 'OBSERVANCE' | 'HOLY_DAY' | 'CUSTOM';
export type DateBasis = 'calculated' | 'khmer_lunar' | 'custom' | 'recorded' | 'corrected' | 'official';

export interface CalendarEvent {
  id: string;
  date: string; // 'YYYY-MM-DD'
  titleKm: string;
  titleEn: string;
  kind: EventKind;
  basis: DateBasis;
  officialSourceUrl?: string | null;
  citation?: string | null;
  citationEn?: string | null;
  citationKm?: string | null;
  sourceIds?: string[];
  time?: string;
  notes?: string;
  instant?: string;
  seriesId?: string;
  repeat?: EventRepeat;
}

export class EventRepository {
  private static yearCache = new Map<number, CalendarEvent[]>();
  private static compiledRules = new Map<string, EngineRecurrenceRule>(
    calendarCatalog.events.filter(e => !!e.rule).map(e => [e.id, createRule(e.rule!)])
  );
  private static sourcesMap = new Map<string, CatalogSource>(
    calendarCatalog.sources.map(s => [s.id, s])
  );
  private static eventsMap = new Map<string, CatalogEvent>(
    calendarCatalog.events.map(e => [e.id, e])
  );

  private static formatHolidayNames(h: CatalogHoliday, year: number): { km: string; en: string } {
    let km = h.names.km;
    let en = h.names.en;
    if (km.includes('{anniversary}') || en.includes('{anniversary}')) {
      const ev = this.eventsMap.get(h.eventId || h.id);
      const base = ev?.anniversaryBase;
      if (base !== undefined) {
        const anniversary = year - base;
        km = km.replaceAll('{anniversary}', khmerNumber(anniversary));
        en = en.replaceAll('{anniversary}', String(anniversary));
      }
    }
    return { km, en };
  }

  private static getSourceInfo(sourceIds: string[]) {
    const sources = sourceIds.map(id => this.sourcesMap.get(id)).filter((s): s is CatalogSource => !!s);
    const govSources = sources.filter(s => s.kind === 'government');
    if (govSources.length === 0) {
      return { url: null, citationEn: null, citationKm: null };
    }
    const withUrl = govSources.find(s => !!s.url);
    const withRef = govSources.find(s => !!s.reference);
    const primary = withRef || govSources[0];

    const url = withUrl?.url || primary?.url || null;
    const citationEn = primary?.reference || primary?.title || null;
    const citationKm = primary?.notes || primary?.reference || primary?.title || null;
    return { url, citationEn, citationKm };
  }

  static hasBundledYear(year: number): boolean {
    return year >= KhmerCalendar.minYear && year <= KhmerCalendar.maxYear;
  }

  static clearCache(): void {
    this.yearCache.clear();
  }

  static getYearEvents(year: number): CalendarEvent[] {
    if (!Number.isInteger(year) || year < KhmerCalendar.minYear || year > KhmerCalendar.maxYear) {
      throw new RangeError('Supported years: 1800–2200.');
    }
    if (this.yearCache.has(year)) {
      return this.yearCache.get(year)!;
    }

    const events: CalendarEvent[] = [];

    // 1. Static date-backed events (Chinese festivals & UNESCO milestones)
    for (const event of calendarCatalog.events) {
      if (!event.dates) continue;
      for (const date of event.dates) {
        if (Number(date.slice(0, 4)) !== year) continue;
        events.push({
          id: event.id,
          date,
          titleKm: event.names.km,
          titleEn: event.names.en,
          kind: 'OBSERVANCE',
          basis: 'recorded',
          sourceIds: event.sourceIds
        });
      }
    }

    // 2. Recurring events evaluated via engine, with historical date overrides
    const yearOverrides = calendarCatalog.overrides.filter(o => o.year === year);
    for (const event of calendarCatalog.events) {
      if (!event.rule) continue;
      if ((event.rule.fromYear !== undefined && year < event.rule.fromYear) ||
          (event.rule.throughYear !== undefined && year > event.rule.throughYear)) continue;

      const rule = this.compiledRules.get(event.id)!;
      const override = yearOverrides.find(o => o.eventId === event.id);
      const replacement = override ? new EventDateOverride(
        event.id,
        year,
        override.dates.map(iso => {
          const [y, m, d] = iso.split('-').map(Number);
          return new GregorianDate(y, m, d);
        }),
        override.sourceId,
        override.reason
      ) : undefined;

      const occurrences = calendarEngine.evaluateRule(year, rule, replacement);
      const names = eventNames(event, year);

      for (const occ of occurrences) {
        if (occ.date.year !== year) continue;
        if (event.kind === 'historical' && event.originalDate && occ.date.iso < event.originalDate) continue;

        const isCorrected = occ.basis === 'source_override';
        const sourceIds = isCorrected && occ.sourceId ? [occ.sourceId] : event.sourceIds;

        events.push({
          id: event.id,
          date: occ.date.iso,
          titleKm: names.km,
          titleEn: names.en,
          kind: 'OBSERVANCE',
          basis: isCorrected ? 'corrected' : 'calculated',
          sourceIds
        });
      }
    }

    // 3. Official public holiday calendars (2020–2027)
    const holidayCalendar = calendarCatalog.holidayCalendars.find(c => c.year === year);
    if (holidayCalendar) {
      for (const h of holidayCalendar.holidays) {
        if (h.status === 'cancelled') continue;
        const { url, citationEn, citationKm } = this.getSourceInfo(h.sourceIds);
        const candidateIds = new Set([
          h.id,
          ...(h.eventId ? [h.eventId] : [])
        ]);

        const holidayNames = this.formatHolidayNames(h, year);

        for (const date of h.dates) {
          const existing = events.find(e => e.date === date && candidateIds.has(e.id));
          if (existing) {
            existing.kind = 'HOLIDAY';
            existing.basis = 'official';
            if (holidayNames.km) existing.titleKm = holidayNames.km;
            if (holidayNames.en) existing.titleEn = holidayNames.en;
            existing.sourceIds = [...new Set([...(existing.sourceIds || []), ...h.sourceIds])];
            if (url) existing.officialSourceUrl = url;
            if (citationEn) existing.citation = citationEn;
            if (citationEn) existing.citationEn = citationEn;
            if (citationKm) existing.citationKm = citationKm;
          } else {
            events.push({
              id: h.id,
              date,
              titleKm: holidayNames.km,
              titleEn: holidayNames.en,
              kind: 'HOLIDAY',
              basis: 'official',
              officialSourceUrl: url,
              citation: citationEn,
              citationEn,
              citationKm,
              sourceIds: h.sourceIds
            });
          }
        }
      }
    }

    // 4. Buddhist Holy Days (Thngai Sil)
    const holyDays = this.calculateHolyDays(year);
    for (const date of holyDays) {
      events.push({
        id: `sil:${date}`,
        date,
        titleKm: L.text('event.holy_day', true),
        titleEn: L.text('event.holy_day', false),
        kind: 'HOLY_DAY',
        basis: 'khmer_lunar'
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
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

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    filtered.push(...this.customForRange(`${monthPrefix}01`, `${monthPrefix}${lastDay}`));

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
    yearEvents.push(...this.customForRange(`${year}-01-01`, `${year}-12-31`));
    return yearEvents.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }

  private static customForRange(from: string, through: string): CalendarEvent[] {
    const zone = Storage.getSettings().todayTimeZone;
    return Storage.getCustomEvents().flatMap(event => customEventOccurrences(event, from, through, zone))
      .map(c => ({
        id: c.id, seriesId: c.seriesId, repeat: c.repeat, date: c.date,
        titleKm: c.title, titleEn: c.title, kind: 'CUSTOM', basis: 'custom',
        time: c.time, notes: c.notes, instant: c.instant
      }));
  }
}
