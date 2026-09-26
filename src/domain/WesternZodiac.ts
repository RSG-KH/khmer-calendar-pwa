// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { calculateHoroscope, type WesternZodiacSign } from 'khmer-calendar-engine';
import { eventInstant, namedTimeZone } from './DateTime';

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
}

/** Standard emoji symbols for Aries (0) through Pisces (11). */
export const WESTERN_ZODIAC_EMOJI: readonly string[] = [
  '♈️', '♉️', '♊️', '♋️', '♌️', '♍️',
  '♎️', '♏️', '♐️', '♑️', '♒️', '♓️'
];

/** Representative city coordinates for common IANA time zones. */
const IANA_COORDINATES: Record<string, [number, number]> = {
  'Asia/Phnom_Penh': [11.5564, 104.9282],
  'Asia/Bangkok': [13.7563, 100.5018],
  'Asia/Vientiane': [17.9757, 102.6331],
  'Asia/Ho_Chi_Minh': [10.8231, 106.6297],
  'Asia/Singapore': [1.3521, 103.8198],
  'Asia/Kuala_Lumpur': [3.1390, 101.6869],
  'Asia/Jakarta': [-6.2088, 106.8456],
  'Asia/Tokyo': [35.6762, 139.6503],
  'Asia/Seoul': [37.5665, 126.9780],
  'Asia/Shanghai': [31.2304, 121.4737],
  'Asia/Hong_Kong': [22.3193, 114.1694],
  'Asia/Taipei': [25.0330, 121.5654],
  'Asia/Yangon': [16.8661, 96.1951],
  'Asia/Kolkata': [22.5726, 88.3639],
  'Asia/Dubai': [25.2048, 55.2708],
  'Europe/London': [51.5074, -0.1278],
  'Europe/Brussels': [50.8503, 4.3517],
  'Europe/Paris': [48.8566, 2.3522],
  'Europe/Berlin': [52.5200, 13.4050],
  'America/New_York': [40.7128, -74.0060],
  'America/Chicago': [41.8781, -87.6298],
  'America/Denver': [39.7392, -104.9903],
  'America/Los_Angeles': [34.0522, -118.2437],
  'America/Toronto': [43.6532, -79.3832],
  'America/Vancouver': [49.2827, -123.1207],
  'Australia/Sydney': [-33.8688, 151.2093],
  'Australia/Melbourne': [-37.8136, 144.9631],
  'Pacific/Auckland': [-36.8485, 174.7633],
  'Pacific/Honolulu': [21.3069, -157.8583]
};

/**
 * Return Western Big 3 columns for a date.
 * - When hour and minute are provided (e.g. Today): computes Sun, Moon, and Rising sign.
 * - When hour and minute are omitted (e.g. past/future dates): computes Sun and Moon at noon midpoint.
 */
export function westernZodiacColumns(options: WesternZodiacOptions): WesternZodiacColumn[] {
  const { year, month, day, hour, minute, second, timeZone } = options;
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

  const coordinates = IANA_COORDINATES[namedTimeZone(zone)];
  const [latitude, longitude] = coordinates ?? [11.5564, utcOffsetHours * 15];

  const horoscope = calculateHoroscope({
    year,
    month,
    day,
    hour: calculationHour,
    minute: calculationMinute,
    second: validSelectedTime ? effSecond : 0,
    utcOffsetHours,
    latitude,
    longitude
  });

  const columns: WesternZodiacColumn[] = [
    { key: 'sun', sign: horoscope.sun.sign },
    { key: 'moon', sign: horoscope.moon.sign },
    { key: 'rising', sign: validSelectedTime ? (horoscope.ascendant?.sign ?? null) : null }
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
