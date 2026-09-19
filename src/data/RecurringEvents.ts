// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { createRule, type RuleInput, type RecurrenceRule as EngineRecurrenceRule } from 'khmer-calendar-engine';
import catalogData from './khmer-calendar-data-0.4.0.json';
import { calendarEngine, KhmerCalendar, khmerNumber } from '../domain/KhmerCalendar';

export interface CatalogNames {
  en: string;
  km: string;
}

export interface CatalogSource {
  id: string;
  kind: 'government' | 'calendar' | 'historical' | 'other';
  title: string;
  publisher: string;
  url?: string;
  reference?: string;
  publishedOn?: string;
  notes?: string;
}

export interface CatalogEvent {
  id: string;
  kind: 'traditional' | 'historical' | 'observance';
  names: CatalogNames;
  sourceIds: string[];
  description?: CatalogNames;
  originalDate?: string;
  dates?: string[];
  rule?: RuleInput;
  anniversaryBase?: number;
}

export interface CatalogHoliday {
  id: string;
  names: CatalogNames;
  dates: string[];
  status: 'draft' | 'active' | 'cancelled';
  sourceIds: string[];
  eventId?: string;
  note?: string;
}

export interface CatalogHolidayCalendar {
  year: number;
  coverage: 'complete' | 'partial';
  sourceIds: string[];
  holidays: CatalogHoliday[];
}

export interface CatalogOverride {
  eventId: string;
  year: number;
  dates: string[];
  sourceId: string;
  reason: string;
}

export interface CatalogNewYearArrival {
  year: number;
  localDate: string;
  localTime: string;
  minuteOfDay: number;
  second: number | null;
  precision: string;
  grade: string;
  status: string;
  role: string;
  interpretedOffset: string;
  interpretedZone: string;
  zoneStated: boolean;
  zoneBasis: string;
  sourceIds: string[];
  retrieved: string;
  sourceConflictNote?: string;
}

export interface CalendarCatalog {
  schemaVersion: 2 | 3;
  dataVersion: string;
  sources: CatalogSource[];
  events: CatalogEvent[];
  eventCalendars: unknown[];
  holidayCalendars: CatalogHolidayCalendar[];
  newYearArrivals?: CatalogNewYearArrival[];
  overrides: CatalogOverride[];
}

export const calendarCatalog = catalogData as CalendarCatalog;

export const newYearArrivalsByYear = new Map<number, CatalogNewYearArrival>(
  calendarCatalog.newYearArrivals?.map(a => [a.year, a]) ?? []
);

export function toKhmerNumerals(rawDigits: string): string {
  const kmDigits = ['\u17E0', '\u17E1', '\u17E2', '\u17E3', '\u17E4', '\u17E5', '\u17E6', '\u17E7', '\u17E8', '\u17E9'];
  return rawDigits.replace(/[0-9]/g, ch => kmDigits[Number(ch)]);
}

export function getKhmerPeriod(hour24: number, minute: number): string {
  if (hour24 < 3) return 'រំលងអធ្រាត្រ';
  if (hour24 < 12) return 'ព្រឹក';
  if (hour24 === 12 && minute === 0) return 'ថ្ងៃត្រង់';
  if (hour24 < 15) return 'រសៀល';
  if (hour24 < 20) return 'ល្ងាច';
  return 'យប់';
}

export function formatNewYearArrivalTime(
  hour24: number,
  minute: number,
  second: number | null = null,
  isOfficial: boolean,
  lang: 'km' | 'en'
): string {
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  if (lang === 'km') {
    const period = getKhmerPeriod(hour24, minute);
    const status = isOfficial ? '(ម៉ោងផ្លូវការ)' : '(ម៉ោងប៉ាន់ស្មាន)';
    const rawDigits = second !== null
      ? `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
      : `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return `ម៉ោង ${toKhmerNumerals(rawDigits)} ${period} ${status}`;
  } else {
    const amPm = hour24 < 12 ? 'AM' : 'PM';
    const status = isOfficial ? '(Official time)' : '(Estimated time)';
    const rawTime = second !== null
      ? `${hour12}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ${amPm}`
      : `${hour12}:${String(minute).padStart(2, '0')} ${amPm}`;
    return `${rawTime} ${status}`;
  }
}

export interface NewYearArrivalDisplay {
  hour24: number;
  minute: number;
  second: number | null;
  isOfficial: boolean;
  titleKm: string;
  titleEn: string;
  sourceIds: string[];
}

export function resolveNewYearArrival(year: number): NewYearArrivalDisplay {
  const record = newYearArrivalsByYear.get(year);
  if (record) {
    const timeParts = record.localTime.split(':').map(Number);
    const hour24 = timeParts[0];
    const minute = timeParts[1];
    const second = record.second ?? (timeParts.length > 2 ? timeParts[2] : null);
    return {
      hour24,
      minute,
      second,
      isOfficial: true,
      titleKm: formatNewYearArrivalTime(hour24, minute, second, true, 'km'),
      titleEn: formatNewYearArrivalTime(hour24, minute, second, true, 'en'),
      sourceIds: record.sourceIds
    };
  } else {
    try {
      const celebration = calendarEngine.newYear(year) as any;
      const arrival = celebration?.arrivalEstimate ?? celebration?.get_arrivalEstimate?.();
      if (arrival) {
        const minuteOfDay = arrival.minuteOfDay;
        const hour24 = arrival.hour ?? (minuteOfDay != null ? Math.floor(minuteOfDay / 60) : (typeof arrival.get_hour === 'function' ? arrival.get_hour() : 0));
        const minute = arrival.minute ?? (minuteOfDay != null ? minuteOfDay % 60 : (typeof arrival.get_minute === 'function' ? arrival.get_minute() : 0));
        return {
          hour24,
          minute,
          second: null,
          isOfficial: false,
          titleKm: formatNewYearArrivalTime(hour24, minute, null, false, 'km'),
          titleEn: formatNewYearArrivalTime(hour24, minute, null, false, 'en'),
          sourceIds: []
        };
      }
    } catch {
      // Graceful fallback if engine calculation is unavailable
    }
    return {
      hour24: 0,
      minute: 0,
      second: null,
      isOfficial: false,
      titleKm: '',
      titleEn: '',
      sourceIds: []
    };
  }
}

export const recurrenceEvents = calendarCatalog.events.filter(e => !!e.rule);
export const recurrenceRules = recurrenceEvents.map(e => e.rule!);

const compiledRules = new Map<string, EngineRecurrenceRule>(
  recurrenceEvents.map(e => [e.id, createRule(e.rule!)])
);

export function eventNames(event: CatalogEvent, year: number): CatalogNames {
  let names = event.names;
  if (event.anniversaryBase !== undefined) {
    const anniversary = year - event.anniversaryBase;
    names = {
      en: event.names.en.replaceAll('{anniversary}', String(anniversary)),
      km: event.names.km.replaceAll('{anniversary}', khmerNumber(anniversary)),
    };
  }
  if (event.id === 'khmer_new_year_1') {
    const arrival = resolveNewYearArrival(year);
    if (arrival.titleEn) {
      names = {
        en: `${names.en} ${arrival.titleEn}`,
        km: `${names.km} ${arrival.titleKm}`,
      };
    }
  }
  return names;
}

export type RuleDates = { rule: RuleInput; event: CatalogEvent; dates: string[] };

export class RecurringEvents {
  static dates(year: number): RuleDates[] {
    if (!Number.isInteger(year) || year < KhmerCalendar.minYear || year > KhmerCalendar.maxYear) {
      throw new RangeError('Supported years: 1800–2200.');
    }
    return recurrenceEvents
      .filter(e => (e.rule!.fromYear === undefined || year >= e.rule!.fromYear) && (e.rule!.throughYear === undefined || year <= e.rule!.throughYear))
      .map(e => {
        const rule = compiledRules.get(e.id)!;
        const dates = calendarEngine.evaluateRule(year, rule).map(event => event.date.iso);
        if (!dates.length || dates.some(date => !date.startsWith(`${year}-`))) {
          throw new Error(`Unexpected recurrence dates: ${e.id}, ${year}`);
        }
        return { rule: e.rule!, event: e, dates };
      });
  }

  static forYear(year: number) {
    return this.fromDates(year, this.dates(year));
  }

  static fromDates(year: number, list: RuleDates[]) {
    return list.flatMap(({ event, dates }) => {
      const names = eventNames(event, year);
      const sourceIds = event.id === 'khmer_new_year_1'
        ? [...new Set([...event.sourceIds, ...resolveNewYearArrival(year).sourceIds])]
        : event.sourceIds;
      return dates.map(date => ({
        id: event.id,
        date,
        km: names.km,
        en: names.en,
        kind: 'OBSERVANCE' as const,
        sourceIds
      }));
    });
  }
}
