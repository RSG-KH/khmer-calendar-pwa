// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { calculateHoroscope, type WesternZodiacSign } from 'khmer-calendar-engine';
import { eventInstant } from './DateTime';

export interface WesternZodiacColumn {
  key: 'sun' | 'moon' | 'rising';
  sign: WesternZodiacSign | null;
}

export interface WesternZodiacOptions {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  timeZone?: string;
  latitude?: number;
  longitude?: number;
}

/** Standard emoji symbols for Aries (0) through Pisces (11). */
export const WESTERN_ZODIAC_EMOJI: readonly string[] = [
  '♈️', '♉️', '♊️', '♋️', '♌️', '♍️',
  '♎️', '♏️', '♐️', '♑️', '♒️', '♓️'
];

/**
 * Return Western Big 3 columns for a date.
 * - When hour and minute are provided (e.g. Today): computes Sun, Moon, and Rising sign.
 * - When hour and minute are omitted (e.g. past/future dates): computes Sun and Moon at noon midpoint.
 * - The supplied civil date and HH:mm remain unchanged; the chosen place's IANA zone
 *   resolves that pair for the engine. Callers must not pre-shift only the Today clock.
 */
export function westernZodiacColumns(options: WesternZodiacOptions): WesternZodiacColumn[] {
  const { year, month, day, hour, minute, second, timeZone, latitude, longitude } = options;
  const hasTime = hour !== undefined && minute !== undefined;

  const effHour = hasTime ? hour : 12;
  const effMinute = hasTime ? minute : 0;
  const effSecond = hasTime ? (second ?? 0) : 0;
  const zone = timeZone ?? 'cambodia';
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const time = `${String(effHour).padStart(2, '0')}:${String(effMinute).padStart(2, '0')}`;
  const selectedInstant = eventInstant(date, time, zone);
  // A clock time skipped by daylight saving time has no corresponding instant.
  // Keep Sun and Moon available at noon, but do not invent a Rising sign.
  const validSelectedTime = hasTime && selectedInstant !== undefined;
  const calculationHour = hasTime && !validSelectedTime ? 12 : effHour;
  const calculationMinute = hasTime && !validSelectedTime ? 0 : effMinute;
  const instant = selectedInstant ?? eventInstant(date, '12:00', zone);
  if (!instant) throw new RangeError('Invalid horoscope date or time zone');
  const utcOffsetHours = (Date.UTC(year, month - 1, day, calculationHour, calculationMinute)
    - Date.parse(instant)) / 3_600_000;

  if ((latitude === undefined) !== (longitude === undefined) ||
      (latitude !== undefined && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
      (longitude !== undefined && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    throw new RangeError('Invalid horoscope coordinates');
  }
  const hasBirthplace = latitude !== undefined && timeZone !== undefined;
  // The engine's combined horoscope API requires coordinates for Sun and Moon,
  // although those two positions do not depend on them. With no birthplace,
  // discard its Ascendant result; zero is never used as a Rising-sign location.
  const horoscope = calculateHoroscope({
    year,
    month,
    day,
    hour: calculationHour,
    minute: calculationMinute,
    second: validSelectedTime ? effSecond : 0,
    utcOffsetHours,
    latitude: latitude ?? 0,
    longitude: longitude ?? 0
  });

  const columns: WesternZodiacColumn[] = [
    { key: 'sun', sign: horoscope.sun.sign },
    { key: 'moon', sign: horoscope.moon.sign },
    { key: 'rising', sign: validSelectedTime && hasBirthplace ? (horoscope.ascendant?.sign ?? null) : null }
  ];

  return columns;
}

export function westernZodiacEmoji(sign: WesternZodiacSign): string {
  return WESTERN_ZODIAC_EMOJI[sign.index] ?? sign.symbol;
}

export function westernZodiacLabel(sign: WesternZodiacSign | null, _khmer: boolean, useEmoji: boolean): string {
  if (!sign) return '—';
  if (useEmoji) return westernZodiacEmoji(sign);
  return sign.englishName;
}

export function westernZodiacTooltip(sign: WesternZodiacSign | null, _khmer: boolean, useEmoji: boolean): string {
  if (!sign) return '';
  if (useEmoji) return sign.englishName;
  return westernZodiacEmoji(sign);
}
