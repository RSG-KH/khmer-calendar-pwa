// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { createRule, type RuleInput, type RecurrenceRule as EngineRecurrenceRule } from 'khmer-calendar-engine';
import catalogData from './khmer-calendar-data-0.3.0.json';
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

export interface CalendarCatalog {
  schemaVersion: 2;
  dataVersion: string;
  sources: CatalogSource[];
  events: CatalogEvent[];
  eventCalendars: unknown[];
  holidayCalendars: CatalogHolidayCalendar[];
  overrides: CatalogOverride[];
}

export const calendarCatalog = catalogData as CalendarCatalog;

export const recurrenceEvents = calendarCatalog.events.filter(e => !!e.rule);
export const recurrenceRules = recurrenceEvents.map(e => e.rule!);

const compiledRules = new Map<string, EngineRecurrenceRule>(
  recurrenceEvents.map(e => [e.id, createRule(e.rule!)])
);

export function eventNames(event: CatalogEvent, year: number): CatalogNames {
  if (event.anniversaryBase === undefined) return event.names;
  const anniversary = year - event.anniversaryBase;
  return {
    en: event.names.en.replaceAll('{anniversary}', String(anniversary)),
    km: event.names.km.replaceAll('{anniversary}', khmerNumber(anniversary)),
  };
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
      return dates.map(date => ({
        id: event.id,
        date,
        km: names.km,
        en: names.en,
        kind: 'OBSERVANCE' as const
      }));
    });
  }
}
