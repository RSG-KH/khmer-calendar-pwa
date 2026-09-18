// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import rawTranslations from './translations.json';
import repeatTranslations from './repeat-translations.json';
import { KhmerDateDetails } from '../domain/KhmerDateDetails';
import { khmerNumber } from '../domain/KhmerCalendar';

const translations: Record<string, { km: string; en: string }> = { ...rawTranslations, ...repeatTranslations };

export class L {
  private static tokenRegex = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

  static template(key: string, khmer: boolean): string {
    const entry = translations[key];
    if (!entry) return key;
    return khmer ? entry.km : entry.en;
  }

  static text(key: string, khmer: boolean, values: Record<string, string | number> = {}): string {
    const tmpl = this.template(key, khmer);
    return tmpl.replace(this.tokenRegex, (_, token) => {
      return values[token] !== undefined ? String(values[token]) : `{${token}}`;
    });
  }
}

export class CalendarWords {
  static month(month: number, khmer: boolean, short: boolean = false): string {
    return L.text(`calendar.month.${short ? 'short' : 'full'}.${month}`, khmer);
  }

  static weekday(dayOfWeek: number, khmer: boolean, style: 'full' | 'short' | 'narrow' | 'grid_long' = 'full'): string {
    // dayOfWeek: 1 = Monday, 7 = Sunday -> % 7 maps 7 to 0 (Sunday)
    return L.text(`calendar.weekday.${style === 'narrow' ? 'grid' : style}.${dayOfWeek % 7}`, khmer);
  }

  static number(value: number, khmer: boolean): string {
    return khmer ? khmerNumber(value) : String(value);
  }

  static date(year: number, month: number, day: number, khmer: boolean): string {
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay();
    return `${L.text('calendar.date_label', khmer, {
      weekday: this.weekday(dayOfWeek, khmer),
      day: this.number(day, khmer),
      month: this.month(month, khmer)
    })} ${this.number(year, khmer)}`;
  }

  static lunarMonth(month: number, khmer: boolean): string {
    return L.text(`calendar.lunar_month.${month}`, khmer);
  }

  static phase(waxing: boolean, khmer: boolean, short: boolean = false): string {
    const key = waxing ? 'waxing' : 'waning';
    return L.text(`calendar.phase.${key}${short ? '_short' : ''}`, khmer);
  }

  static lunarShort(day: number, waxing: boolean, khmer: boolean): string {
    return L.text('calendar.lunar_short', khmer, {
      day: this.number(day, khmer),
      phase: this.phase(waxing, khmer, true)
    });
  }

  static lunarFull(day: number, waxing: boolean, month: number, khmer: boolean): string {
    return L.text('calendar.lunar_full', khmer, {
      short: this.lunarShort(day, waxing, khmer),
      day: this.number(day, khmer),
      phase: this.phase(waxing, khmer, false),
      month: this.lunarMonth(month, khmer)
    });
  }

  static animal(index: number, khmer: boolean): string {
    return L.text(`calendar.animal.${index}`, khmer);
  }

  static sak(index: number, khmer: boolean): string {
    return L.text(`calendar.sak.${index}`, khmer);
  }

  static fullKhmerDate(d: KhmerDateDetails): string {
    const dateObj = new Date(Date.UTC(d.year, d.month - 1, d.day));
    const dayOfWeek = dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay();
    let monthName = this.month(d.month, true);
    if (monthName.startsWith('ខែ')) {
      monthName = monthName.replace(/^ខែ/, '');
    }

    const animalStr = d.animalYearChangesToday
      ? `${this.animal((d.animalYear - 1 + 12) % 12, true)} → ${this.animal(d.animalYear, true)}`
      : this.animal(d.animalYear, true);

    return L.text('calendar.full_date', true, {
      weekday: this.weekday(dayOfWeek, true),
      lunar: this.lunarFull(d.lunar.day, d.lunar.waxing, d.lunar.month, true),
      animal: animalStr,
      sak: this.sak(d.sak, true),
      buddhist_year: this.number(d.lunar.buddhistYear, true),
      day: this.number(d.day, true),
      month: monthName,
      year: this.number(d.year, true)
    });
  }

  static fullEnglishDate(d: KhmerDateDetails): string {
    const dateObj = new Date(Date.UTC(d.year, d.month - 1, d.day));
    const dayOfWeek = dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay();
    const monthName = this.month(d.month, false);

    const animalStr = d.animalYearChangesToday
      ? `${this.animal((d.animalYear - 1 + 12) % 12, false)} → ${this.animal(d.animalYear, false)}`
      : this.animal(d.animalYear, false);

    return L.text('calendar.full_date', false, {
      weekday: this.weekday(dayOfWeek, false),
      lunar: this.lunarFull(d.lunar.day, d.lunar.waxing, d.lunar.month, false),
      animal: animalStr,
      sak: this.sak(d.sak, false),
      buddhist_year: this.number(d.lunar.buddhistYear, false),
      day: this.number(d.day, false),
      month: monthName,
      year: this.number(d.year, false)
    });
  }
}
