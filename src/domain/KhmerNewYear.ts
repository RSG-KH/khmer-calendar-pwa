// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { calendarEngine, KhmerCalendar } from './KhmerCalendar';

export interface ArrivalEstimate {
  minuteOfDay: number;
  hour: number;
  minute: number;
}

export interface NewYearCelebration {
  startYear: number;
  startMonth: number;
  startDay: number;
  startDate: string;
  days: number;
  dates: string[];
  arrivalEstimate: ArrivalEstimate;
}

export class KhmerNewYear {
  static forYear(year: number): NewYearCelebration {
    if (!Number.isInteger(year) || year < KhmerCalendar.minYear || year > KhmerCalendar.maxYear) {
      throw new RangeError('Supported years: 1800–2200.');
    }
    const result = calendarEngine.newYear(year);
    const est = result.arrivalEstimate;
    return {
      startYear: result.start.year, startMonth: result.start.month, startDay: result.start.day,
      startDate: result.start.iso, days: result.days, dates: result.dates.map(date => date.iso),
      arrivalEstimate: {
        minuteOfDay: est.minuteOfDay,
        hour: est.hour,
        minute: est.minute
      }
    };
  }
}
