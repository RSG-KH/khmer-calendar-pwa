// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { dateTimeInZone, isSupportedDate, TodayTimeZone } from '../domain/DateTime';
import { validRepeat, type EventRepeat } from '../domain/EventRepeat';
import { defaultFontScale, type FontScale } from '../ui/Platform';
import { DEFAULT_RISING_PLACE, validBirthplace, type BirthplaceSelection } from './Birthplaces';

export type AccentColor = 'blue' | 'lavender' | 'rose' | 'amber' | 'lime';
export type ThemeMode = 'system' | 'light' | 'dark';
export type { FontScale };

export interface AppSettings {
  language: 'km' | 'en';
  theme: ThemeMode;
  accent: AccentColor;
  backgroundAccent: boolean;
  fontScale: FontScale;
  holyDayMarkers: boolean;
  showHolyDaysInEvents: boolean;
  mondayFirst: boolean;
  showLongerWeekdayNames: boolean;
  highlightWeekdayNames: boolean;
  showCopyButtons: boolean;
  enableAstrologyAndZodiac: boolean;
  showWesternZodiac: boolean;
  useEmojiForWesternZodiac: boolean;
  pastFutureTime: string;
  risingPlace: BirthplaceSelection;
  showGanzhi: boolean;
  useEmojiForGanzhiAnimals: boolean;
  showObservances: boolean;
  highlightSunday: boolean;
  showLunar: boolean;
  todayTimeZone: TodayTimeZone;
  notificationsEnabled: boolean;
  shavingDayReminder: boolean;
  holidayReminder: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'km',
  theme: 'system',
  accent: 'blue',
  backgroundAccent: true,
  fontScale: defaultFontScale(),
  holyDayMarkers: true,
  showHolyDaysInEvents: false,
  mondayFirst: false,
  showLongerWeekdayNames: false,
  highlightWeekdayNames: true,
  showCopyButtons: false,
  enableAstrologyAndZodiac: true,
  showWesternZodiac: true,
  useEmojiForWesternZodiac: false,
  pastFutureTime: '12:00',
  risingPlace: DEFAULT_RISING_PLACE,
  showGanzhi: true,
  useEmojiForGanzhiAnimals: false,
  showObservances: true,
  highlightSunday: true,
  showLunar: true,
  todayTimeZone: 'local',
  notificationsEnabled: false,
  shavingDayReminder: false,
  holidayReminder: true
};

export function enabledAstrologyFeatures(settings: AppSettings): { western: boolean; ganzhi: boolean } {
  return {
    western: settings.enableAstrologyAndZodiac && settings.showWesternZodiac,
    ganzhi: settings.enableAstrologyAndZodiac && settings.showGanzhi
  };
}

export interface CustomEvent {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time?: string; // 'HH:mm'
  notes?: string;
  remind?: boolean;
  instant?: string;
  repeat?: EventRepeat;
}

const LOCAL_EVENTS_KEY = 'khmer_calendar_custom_events';
const LOCAL_SETTINGS_KEY = 'khmer_calendar_settings';
const LOCAL_BIRTHPLACE_KEY = 'khmer_calendar_rising_place';
const LOCAL_MANUAL_BIRTHPLACES_KEY = 'khmer_calendar_manual_rising_places';
const LOCAL_CATALOG_BIRTHPLACES_KEY = 'khmer_calendar_catalog_rising_places';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validStoredEvent(value: unknown): value is CustomEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
      typeof value.title !== 'string' || !value.title.trim() ||
      typeof value.date !== 'string' || !isSupportedDate(value.date)) return false;
  if (value.time !== undefined && (typeof value.time !== 'string' ||
      value.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))) return false;
  if (value.notes !== undefined && typeof value.notes !== 'string') return false;
  if (value.instant !== undefined && (typeof value.instant !== 'string' ||
      !Number.isFinite(Date.parse(value.instant)))) return false;
  if (value.repeat !== undefined) {
    const repeat = value.repeat;
    if (!isRecord(repeat) || typeof repeat.until !== 'string' || typeof repeat.timeZone !== 'string' ||
        !repeat.timeZone || !validRepeat(value.date, repeat as unknown as EventRepeat)) return false;
    if (repeat.includeThirty !== undefined && typeof repeat.includeThirty !== 'boolean' ||
        repeat.includeFebruary !== undefined && typeof repeat.includeFebruary !== 'boolean') return false;
    try { dateTimeInZone(new Date(0), repeat.timeZone); }
    catch { return false; }
  }
  return true;
}

class StorageManager {
  getCatalogBirthplaces(): BirthplaceSelection[] {
    try {
      const raw = localStorage.getItem(LOCAL_CATALOG_BIRTHPLACES_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      const places = Array.isArray(saved) ? saved.filter((place): place is BirthplaceSelection =>
        validBirthplace(place) && place.source !== 'manual') : [];
      const current = this.getBirthplace();
      if (!raw && current && current.source !== 'manual') places.push(current);
      return places;
    } catch { return []; }
  }

  saveCatalogBirthplaces(places: BirthplaceSelection[]): void {
    if (!places.every(place => validBirthplace(place) && place.source !== 'manual')) {
      throw new RangeError('Invalid catalog place');
    }
    localStorage.setItem(LOCAL_CATALOG_BIRTHPLACES_KEY, JSON.stringify(places));
  }

  getManualBirthplaces(): BirthplaceSelection[] {
    try {
      const raw = localStorage.getItem(LOCAL_MANUAL_BIRTHPLACES_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      const places = Array.isArray(saved) ? saved.filter((place): place is BirthplaceSelection =>
        validBirthplace(place) && place.source === 'manual') : [];
      const current = this.getBirthplace();
      if (!raw && current?.source === 'manual') {
        places.push(current);
      }
      return places;
    } catch { return []; }
  }

  saveManualBirthplaces(places: BirthplaceSelection[]): void {
    if (!places.every(place => validBirthplace(place) && place.source === 'manual')) {
      throw new RangeError('Invalid manual place');
    }
    localStorage.setItem(LOCAL_MANUAL_BIRTHPLACES_KEY, JSON.stringify(places));
  }

  getBirthplace(): BirthplaceSelection | null {
    try {
      const raw = localStorage.getItem(LOCAL_BIRTHPLACE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return validBirthplace(parsed) ? parsed : null;
    } catch { return null; }
  }

  saveBirthplace(place: BirthplaceSelection | null): void {
    if (place && !validBirthplace(place)) throw new RangeError('Invalid Rising-sign place');
    if (place) localStorage.setItem(LOCAL_BIRTHPLACE_KEY, JSON.stringify(place));
    else localStorage.removeItem(LOCAL_BIRTHPLACE_KEY);
  }

  getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (stored) {
        const value: unknown = JSON.parse(stored);
        const parsed = isRecord(value) ? value : {};
        if (parsed.showWesternZodiac === undefined && typeof parsed.hideWesternZodiac === 'boolean') {
          parsed.showWesternZodiac = !parsed.hideWesternZodiac;
        }
        const pastFutureTime = typeof parsed.pastFutureTime === 'string' &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.pastFutureTime) ? parsed.pastFutureTime : DEFAULT_SETTINGS.pastFutureTime;
        const risingPlace = validBirthplace(parsed.risingPlace) ? parsed.risingPlace
          : this.getBirthplace() ?? DEFAULT_RISING_PLACE;
        const settings = { ...DEFAULT_SETTINGS, pastFutureTime, risingPlace };
        // Persisted JSON is untyped: one damaged preference must not stop startup.
        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
          if (typeof DEFAULT_SETTINGS[key] === 'boolean' && typeof parsed[key] === 'boolean') {
            Object.assign(settings, { [key]: parsed[key] });
          }
        }
        if (parsed.language === 'km' || parsed.language === 'en') settings.language = parsed.language;
        if (parsed.theme === 'system' || parsed.theme === 'light' || parsed.theme === 'dark') settings.theme = parsed.theme;
        if (typeof parsed.accent === 'string' && ['blue', 'lavender', 'rose', 'amber', 'lime'].includes(parsed.accent)) settings.accent = parsed.accent as AccentColor;
        if (parsed.todayTimeZone === 'local' || parsed.todayTimeZone === 'cambodia') settings.todayTimeZone = parsed.todayTimeZone;
        if (typeof parsed.fontScale === 'number' && Number.isFinite(parsed.fontScale) &&
            parsed.fontScale >= 0.8 && parsed.fontScale <= 1.5) settings.fontScale = parsed.fontScale as FontScale;
        return settings;
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS, risingPlace: this.getBirthplace() ?? DEFAULT_RISING_PLACE };
  }

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  getCustomEvents(): CustomEvent[] {
    try {
      const zone = this.getSettings().todayTimeZone;
      return this.getStoredCustomEvents().filter(validStoredEvent).map(event => event.instant && !event.repeat
        ? { ...event, ...dateTimeInZone(new Date(event.instant), zone) }
        : event);
    } catch (e) {
      console.warn('Error reading custom events:', e);
      return [];
    }
  }

  private getStoredCustomEvents(): unknown[] {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (!raw) return [];
    const events: unknown = JSON.parse(raw);
    if (!Array.isArray(events)) throw new TypeError('Saved events must be an array');
    // Keep unrecognized records on disk when other events are edited. An
    // unreadable collection must fail saving instead of overwriting user data.
    return events;
  }

  saveCustomEventSync(event: CustomEvent): void {
    if (!validStoredEvent(event)) throw new RangeError('Invalid custom event');
    const list = this.getStoredCustomEvents();
    const idx = list.findIndex(e => isRecord(e) && e.id === event.id);
    if (idx >= 0) {
      list[idx] = event;
    } else {
      list.push(event);
    }
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(list));
  }

  deleteCustomEventSync(id: string): void {
    const list = this.getStoredCustomEvents().filter(e => !isRecord(e) || e.id !== id);
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(list));
  }

  async getAllCustomEvents(): Promise<CustomEvent[]> {
    return this.getCustomEvents();
  }

  async saveCustomEvent(event: CustomEvent): Promise<void> {
    this.saveCustomEventSync(event);
  }

  async deleteCustomEvent(id: string): Promise<void> {
    this.deleteCustomEventSync(id);
  }
}

export const Storage = new StorageManager();
