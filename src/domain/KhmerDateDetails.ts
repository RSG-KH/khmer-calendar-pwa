// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { KhmerCalendar, LunarDate } from './KhmerCalendar';
import { Zodiac, ZodiacSign } from './Zodiac';

export class KhmerDateDetails {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly lunar: LunarDate;
  readonly animalYear: number;
  readonly sak: number;
  readonly animalYearChangesToday: boolean;
  #zodiac?: ZodiacSign;

  constructor(year: number, month: number, day: number) {
    this.year = year;
    this.month = month;
    this.day = day;
    const result = KhmerCalendar.details(year, month, day);
    this.lunar = result.lunar;
    this.animalYear = result.animalYear;
    this.sak = result.sak;
    this.animalYearChangesToday = result.animalYearChangesToday;
  }

  get zodiac(): ZodiacSign {
    return this.#zodiac ??= Zodiac.forMonthDay(this.month, this.day);
  }

  static fromGregorian(year: number, month: number, day: number): KhmerDateDetails {
    return new KhmerDateDetails(year, month, day);
  }
}
