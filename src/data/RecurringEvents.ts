// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { createRule, type RuleInput } from 'khmer-calendar-engine';
import rawRules from './recurrence-rules.json';
import { calendarEngine, KhmerCalendar, khmerNumber } from '../domain/KhmerCalendar';
import { L } from './i18n';

export interface RecurrenceRule {
  id: string;
  titleKey: string;
  type: 'khmer_lunar' | 'solar' | 'new_year_first' | 'new_year_middle' | 'new_year_last' | 'solar_nth_weekday';
  month: number;
  day: number;
  waxing: boolean;
  offset: number;
  duration: number;
  fromYear: number;
  throughYear: number;
  anniversaryBase: number | null;
  monthPolicy?: 'exact' | 'ordinary_or_second_asadh';
}

export const recurrenceRules = rawRules as RecurrenceRule[];

/** App JSON includes labels and legacy fields that are not engine inputs. */
export function engineRuleInput(rule: RecurrenceRule): RuleInput {
  const base = {
    id: rule.id, offset: rule.offset, duration: rule.duration,
    fromYear: rule.fromYear, throughYear: rule.throughYear
  };
  switch (rule.type) {
    case 'solar': return { ...base, type: rule.type, month: rule.month, day: rule.day };
    case 'solar_nth_weekday': return {
      ...base, type: rule.type, month: rule.month, day: rule.day, offset: 0, occurrence: rule.offset
    };
    case 'khmer_lunar': return {
      ...base, type: rule.type, month: rule.month, day: rule.day, waxing: rule.waxing,
      monthPolicy: rule.monthPolicy ?? 'exact'
    };
    default: return { ...base, type: rule.type };
  }
}

const calculations = new Map(recurrenceRules.map(rule => [rule, createRule(engineRuleInput(rule))]));
export type RuleDates = { rule: RecurrenceRule; dates: string[] };

export class RecurringEvents {
  static dates(year: number): RuleDates[] {
    if (!Number.isInteger(year) || year < KhmerCalendar.minYear || year > KhmerCalendar.maxYear) {
      throw new RangeError('Supported years: 1800–2200.');
    }
    return recurrenceRules.filter(rule => year >= rule.fromYear && year <= rule.throughYear).map(rule => {
      const dates = calendarEngine.evaluateRule(year, calculations.get(rule)!).map(event => event.date.iso);
      // Current definitions stay within their anchor year. Future cross-year rules
      // must explicitly extend the repository's Gregorian-year view contract.
      if (!dates.length || dates.some(date => !date.startsWith(`${year}-`))) {
        throw new Error(`Unexpected recurrence dates: ${rule.id}, ${year}`);
      }
      return { rule, dates };
    });
  }

  static forYear(year: number) {
    return this.fromDates(year, this.dates(year));
  }

  static fromDates(year: number, list: RuleDates[]) {
    return list.flatMap(({ rule, dates }) => {
      const anniversary = rule.anniversaryBase === null ? null : year - rule.anniversaryBase;
      const title = (khmer: boolean) => L.text(rule.titleKey, khmer, anniversary === null ? {} : {
        anniversary: khmer ? khmerNumber(anniversary) : String(anniversary)
      });
      return dates.map(date => ({
        id: `calculated:${rule.id}`, date, km: title(true), en: title(false), kind: 'OBSERVANCE' as const
      }));
    });
  }
}
