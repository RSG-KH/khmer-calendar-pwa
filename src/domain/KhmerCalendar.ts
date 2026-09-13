// Copyright (c) 2026 RSG-KH | Apache-2.0 License

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

interface MonthStart {
  epochDay: number;
  month: number;
  length: number;
}

export class KhmerCalendar {
  static readonly minYear = 1800;
  static readonly maxYear = 2200;

  private static approximateYear(year: number, month: number): number {
    return year + (month <= 4 ? 543 : 544);
  }

  private static aharkun(year: number): bigint {
    return (BigInt(year) * 292207n + 499n) / 800n + 4n;
  }

  private static avoman(year: number): number {
    const ah = this.aharkun(year);
    return Number((11n * ah + 25n) % 692n);
  }

  private static bodithey(year: number): number {
    const ah = this.aharkun(year);
    return Number(((11n * ah + 25n) / 692n + ah + 29n) % 30n);
  }

  private static rawLeap(year: number): number {
    const b = this.bodithey(year);
    const a = this.avoman(year);
    const leapMonth = (b === 25 && this.bodithey(year + 1) === 5) ? false
      : (b === 24 && this.bodithey(year + 1) === 6) || b >= 25 || b <= 5;
    const solarLeap = (800n - (BigInt(year) * 292207n + 499n) % 800n) <= 207n;
    const leapDay = solarLeap ? a <= 126 : (a <= 137 && !(a === 137 && this.avoman(year + 1) === 0));
    return (leapMonth ? 1 : 0) + (leapDay ? 2 : 0);
  }

  static leapType(year: number): number {
    const type = this.rawLeap(year);
    if ((type & 1) !== 0) return 1;
    if ((type & 2) !== 0) return 2;
    let previous = year - 1;
    while ((this.rawLeap(previous) & 1) !== 0) {
      if ((this.rawLeap(previous) & 2) !== 0) return 2;
      previous--;
    }
    return 0;
  }

  private static monthLength(month: number, year: number): number {
    if (month === 6 && this.leapType(year) === 2) return 30;
    if (month >= 12) return 30;
    if (month % 2 === 0) return 29;
    return 30;
  }

  private static nextMonth(month: number, year: number): number {
    if (month === 6) return this.leapType(year) === 1 ? 12 : 7;
    if (month === 11) return 0;
    if (month === 12) return 13;
    if (month === 13) return 8;
    return month + 1;
  }

  private static monthStarts: MonthStart[] = (() => {
    const starts: MonthStart[] = [];
    const maxEpochDay = toEpochDay(2200, 12, 31) + 31;
    let currEpoch = toEpochDay(1799, 12, 27);
    let currMonth = 1;

    while (currEpoch <= maxEpochDay) {
      const { year, month } = fromEpochDay(currEpoch);
      const approx = KhmerCalendar.approximateYear(year, month);
      const len = KhmerCalendar.monthLength(currMonth, approx);
      starts.push({ epochDay: currEpoch, month: currMonth, length: len });
      currEpoch += len;
      currMonth = KhmerCalendar.nextMonth(currMonth, approx);
    }
    return starts;
  })();

  private static buddhistNewYears: Record<number, number> = (() => {
    const map: Record<number, number> = {};
    for (const m of KhmerCalendar.monthStarts) {
      if (m.month === 5) {
        const { year } = fromEpochDay(m.epochDay);
        map[year] = m.epochDay + 15;
      }
    }
    return map;
  })();

  static fromGregorian(year: number, month: number, day: number): LunarDate {
    const epoch = toEpochDay(year, month, day);
    const normalized = fromEpochDay(epoch);
    if (year < this.minYear || year > this.maxYear || normalized.year !== year || normalized.month !== month || normalized.day !== day) {
      throw new RangeError('Date must be a valid Gregorian date between 1800 and 2200.');
    }
    const starts = this.monthStarts;

    let low = 0;
    let high = starts.length - 1;
    let idx = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (starts[mid].epochDay <= epoch) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const start = starts[idx];
    const offset = epoch - start.epochDay;
    const lunarDay = (offset % 15) + 1;
    const waxing = offset < 15;
    const beEpoch = this.buddhistNewYears[year] || toEpochDay(year, 5, 15);
    const beYear = year + (epoch < beEpoch ? 543 : 544);
    const mLen = start.length;

    const isHolyDay = lunarDay === 8 || (waxing && lunarDay === 15) || (!waxing && lunarDay === mLen - 15);
    const isShavingDay = lunarDay === 7 || (waxing && lunarDay === 14) || (!waxing && lunarDay === mLen - 16);

    return {
      day: lunarDay,
      waxing,
      month: start.month,
      buddhistYear: beYear,
      monthLength: mLen,
      isHolyDay,
      isShavingDay
    };
  }
}
