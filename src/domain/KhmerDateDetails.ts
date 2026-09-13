// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { KhmerCalendar, LunarDate, khmerNumber, toEpochDay } from './KhmerCalendar';
import { KhmerNewYear } from './KhmerNewYear';
import { Zodiac, ZodiacSign } from './Zodiac';

export class KhmerDateDetails {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly lunar: LunarDate;
  readonly animalYear: number;
  readonly sak: number;
  readonly animalYearChangesToday: boolean;
  readonly zodiac: ZodiacSign;

  constructor(year: number, month: number, day: number) {
    this.year = year;
    this.month = month;
    this.day = day;
    this.lunar = KhmerCalendar.fromGregorian(year, month, day);

    const newYear = KhmerNewYear.forYear(year);
    const lerngSakDay = toEpochDay(newYear.startYear, newYear.startMonth, newYear.startDay) + newYear.days - 1;
    const currentEpoch = toEpochDay(year, month, day);
    const newYearStartEpoch = toEpochDay(newYear.startYear, newYear.startMonth, newYear.startDay);

    this.animalYear = ((year - 4 - (currentEpoch < newYearStartEpoch ? 1 : 0)) % 12 + 12) % 12;
    this.sak = ((year - 638 - (currentEpoch < lerngSakDay ? 1 : 0)) % 10 + 10) % 10;
    this.animalYearChangesToday = currentEpoch === newYearStartEpoch;
    this.zodiac = Zodiac.forMonthDay(month, day);
  }

  static fromGregorian(year: number, month: number, day: number): KhmerDateDetails {
    return new KhmerDateDetails(year, month, day);
  }
}
