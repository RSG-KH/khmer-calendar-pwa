// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { KhmerCalendarEngine, type CalendarDate } from 'khmer-calendar-engine';

export interface LunarDate {
  day: number;
  waxing: boolean;
  month: number;
  buddhistYear: number;
  monthLength: number;
  isHolyDay: boolean;
  isShavingDay: boolean;
}

export function khmerNumber(value: number): string {
  const kmDigits = ['\u17E0', '\u17E1', '\u17E2', '\u17E3', '\u17E4', '\u17E5', '\u17E6', '\u17E7', '\u17E8', '\u17E9'];
  return String(value).split('').map(char => {
    const code = char.charCodeAt(0) - 48;
    return (code >= 0 && code <= 9) ? kmDigits[code] : char;
  }).join('');
}

export function toEpochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function fromEpochDay(epochDay: number): { year: number; month: number; day: number } {
  const d = new Date(epochDay * 86400000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  };
}

export const calendarEngine = new KhmerCalendarEngine();

/** Civil-date validation and app-facing labels; calculations belong to the engine. */
export class KhmerCalendar {
  static readonly minYear = calendarEngine.minYear;
  static readonly maxYear = calendarEngine.maxYear;

  static details(year: number, month: number, day: number): CalendarDate {
    const normalized = fromEpochDay(toEpochDay(year, month, day));
    if (![year, month, day].every(Number.isInteger) || year < this.minYear || year > this.maxYear
      || normalized.year !== year || normalized.month !== month || normalized.day !== day) {
      throw new RangeError('Date must be a valid Gregorian date between 1800 and 2200.');
    }
    return calendarEngine.fromGregorian(year, month, day);
  }

  static fromGregorian(year: number, month: number, day: number): LunarDate {
    return this.details(year, month, day).lunar;
  }
}
