// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { KhmerCalendar, toEpochDay, fromEpochDay } from './KhmerCalendar';

export interface NewYearCelebration {
  startYear: number;
  startMonth: number;
  startDay: number;
  startDate: string;
  days: number;
  dates: string[];
}

export class KhmerNewYear {
  private static aharkun(year: number): bigint {
    return (BigInt(year) * 292207n + 373n) / 800n + 1n;
  }

  private static kromthupul(year: number): number {
    return Number(800n - (BigInt(year) * 292207n + 373n) % 800n);
  }

  private static avoman(year: number): number {
    return Number((this.aharkun(year) * 11n + 650n) % 692n);
  }

  private static bodithey(year: number): number {
    const ah = this.aharkun(year);
    return Number((ah + (11n * ah + 650n) / 692n) % 30n);
  }

  private static leapMonth(year: number): boolean {
    const b = this.bodithey(year);
    const next = this.bodithey(year + 1);
    if (b === 24 && next === 6) return true;
    if (b === 25 && next === 5) return false;
    return b > 24 || b < 6;
  }

  private static leapDay(year: number): boolean {
    const a = this.avoman(year);
    if (a === 0 && this.avoman(year - 1) === 137) return true;
    if (this.kromthupul(year) <= 207) return a < 127;
    if (a === 137 && this.avoman(year + 1) === 0) return false;
    return a < 138;
  }

  private static solarDegree(year: number, sotin: number): number {
    const r2 = 800 * sotin + this.kromthupul(year - 1);
    const average = 1800 * Math.floor(r2 / 24350) + 60 * Math.floor((r2 % 24350) / 811) + Math.floor((r2 % 24350 % 811) / 14) - 3;
    const left = average < 4800 ? average - 4800 + 21600 : average - 4800;
    const quadrant = Math.floor(left / 1800);
    let remainder = 0;
    if (quadrant <= 2) remainder = quadrant;
    else if (quadrant <= 5) remainder = 10800 - left;
    else if (quadrant <= 8) remainder = left - 10800;
    else remainder = 21600 - left;

    const angle = Math.floor((remainder % 1800) / 60);
    const minute = remainder % 60;
    const segment = 2 * Math.floor(remainder / 1800) + (angle >= 15 ? 1 : 0);
    const portion = 60 * (angle >= 15 ? angle - 15 : angle) + minute;
    const multipliers = [35, 32, 27, 22, 13, 5];
    const corrections = [0, 35, 67, 94, 116, 129];
    const correction = segment <= 5 ? Math.floor((portion * multipliers[segment]) / 900) + corrections[segment] : 134;
    const inauguration = quadrant <= 5 ? average - correction : average + correction;
    return Math.floor((inauguration % 1800) / 60);
  }

  static forYear(year: number): NewYearCelebration {
    const jsYear = year - 638;
    const firstSotin = this.kromthupul(jsYear - 1) <= 207 ? 363 : 362;
    const days = this.solarDegree(jsYear, firstSotin) === 0 ? 4 : 3;
    let b = this.bodithey(jsYear);
    if (this.leapMonth(jsYear - 1) && this.leapDay(jsYear - 1)) b = (b + 1) % 30;
    const lerngSakMonth = b >= 6 ? 4 : 5;
    const lerngSakDay = b >= 6 ? b - 1 : b;

    const epoch = toEpochDay(year, 4, 17);
    const lunar = KhmerCalendar.fromGregorian(year, 4, 17);
    const ordinal = lunar.day - 1 + (lunar.waxing ? 0 : 15);
    const difference = (lunar.month - 4) * 29 + ordinal - ((lerngSakMonth - 4) * 29 + lerngSakDay);

    let startEpoch = epoch - (difference + days - 1);
    if (year >= 2011 && year <= 2015) {
      startEpoch = toEpochDay(year, 4, 14);
    } else if (year === 2024) {
      startEpoch = toEpochDay(year, 4, 13);
    }

    const { year: sy, month: sm, day: sd } = fromEpochDay(startEpoch);
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const { year: dy, month: dm, day: dd } = fromEpochDay(startEpoch + i);
      dates.push(`${dy}-${String(dm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
    }

    return {
      startYear: sy,
      startMonth: sm,
      startDay: sd,
      startDate: `${sy}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`,
      days,
      dates
    };
  }
}
