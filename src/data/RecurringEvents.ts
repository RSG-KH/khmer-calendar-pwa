// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import rawRules from './recurrence-rules.json';
import { KhmerCalendar, LunarDate, toEpochDay, fromEpochDay, khmerNumber } from '../domain/KhmerCalendar';
import { KhmerNewYear } from '../domain/KhmerNewYear';
import { L } from './i18n';

export interface RecurrenceRule {
  id: string;
  titleKey: string;
  comparisonKey: string;
  type: 'khmer_lunar' | 'solar' | 'new_year_first' | 'new_year_middle' | 'new_year_last' | 'solar_nth_weekday';
  month: number;
  day: number;
  waxing: boolean;
  offset: number;
  duration: number;
  fromYear: number;
  throughYear: number;
  anniversaryBase: number | null;
  secondAsadh?: boolean;
}

const rules: RecurrenceRule[] = rawRules as any;

export class RecurringEvents {
  private static matches(rule: RecurrenceRule, lunar: LunarDate): boolean {
    return lunar.day === rule.day &&
      lunar.waxing === rule.waxing &&
      (lunar.month === rule.month || (Boolean(rule.secondAsadh) && lunar.month === 13));
  }

  static dates(year: number): { rule: RecurrenceRule; dates: string[] }[] {
    const active = rules.filter(r => year >= r.fromYear && year <= r.throughYear);
    const lunarRules = active.filter(r => r.type === 'khmer_lunar');
    const anchors = new Map<string, number>();

    let startDay = toEpochDay(year, 1, 1);
    const endDay = toEpochDay(year, 12, 31);

    for (let epoch = startDay; epoch <= endDay; epoch++) {
      const { year: dy, month: dm, day: dd } = fromEpochDay(epoch);
      const lunar = KhmerCalendar.fromGregorian(dy, dm, dd);
      for (const rule of lunarRules) {
        if (this.matches(rule, lunar)) {
          anchors.set(rule.id, epoch);
        }
      }
    }

    const newYear = KhmerNewYear.forYear(year);

    return active.map(rule => {
      const resultDates: string[] = [];
      if (rule.type === 'new_year_first') {
        resultDates.push(newYear.dates[0]);
      } else if (rule.type === 'new_year_middle') {
        for (let i = 1; i < newYear.dates.length - 1; i++) {
          resultDates.push(newYear.dates[i]);
        }
      } else if (rule.type === 'new_year_last') {
        resultDates.push(newYear.dates[newYear.dates.length - 1]);
      } else if (rule.type === 'solar_nth_weekday') {
        const firstDayEpoch = toEpochDay(year, rule.month, 1);
        const dayOfWeek = (new Date(firstDayEpoch * 86400000).getUTCDay() + 6) % 7 + 1; // 1 = Monday..7 = Sunday
        const daysToAdd = ((rule.day - dayOfWeek + 7) % 7) + (rule.offset - 1) * 7;
        const anchorEpoch = firstDayEpoch + daysToAdd;
        for (let i = 0; i < rule.duration; i++) {
          const { year: y, month: m, day: d } = fromEpochDay(anchorEpoch + i);
          resultDates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      } else if (rule.type === 'solar') {
        const anchorEpoch = toEpochDay(year, rule.month, rule.day);
        for (let i = 0; i < rule.duration; i++) {
          const { year: y, month: m, day: d } = fromEpochDay(anchorEpoch + rule.offset + i);
          resultDates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      } else {
        const anchorEpoch = anchors.get(rule.id);
        if (anchorEpoch !== undefined) {
          for (let i = 0; i < rule.duration; i++) {
            const { year: y, month: m, day: d } = fromEpochDay(anchorEpoch + rule.offset + i);
            resultDates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          }
        }
      }
      return { rule, dates: resultDates };
    });
  }

  static forYear(year: number): { id: string; date: string; km: string; en: string; kind: 'OBSERVANCE' }[] {
    const list = this.dates(year);
    const result: { id: string; date: string; km: string; en: string; kind: 'OBSERVANCE' }[] = [];
    for (const { rule, dates } of list) {
      const anniversary = rule.anniversaryBase !== null ? year - rule.anniversaryBase : null;
      const titleKm = anniversary === null
        ? L.text(rule.titleKey, true)
        : L.text(rule.titleKey, true, { anniversary: khmerNumber(anniversary) });
      const titleEn = anniversary === null
        ? L.text(rule.titleKey, false)
        : L.text(rule.titleKey, false, { anniversary: String(anniversary) });

      for (const d of dates) {
        result.push({
          id: `calculated:${rule.id}`,
          date: d,
          km: titleKm,
          en: titleEn,
          kind: 'OBSERVANCE'
        });
      }
    }
    return result;
  }
}
