// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { dateTimeInZone, TodayTimeZone } from '../domain/DateTime';
import type { EventRepeat } from '../domain/EventRepeat';

export type AccentColor = 'blue' | 'lavender' | 'rose' | 'amber' | 'lime';
export type ThemeMode = 'system' | 'light' | 'dark';
export type FontScale = 0.8 | 0.9 | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5;

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
  showWesternZodiac: boolean;
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
  fontScale: 1.0,
  holyDayMarkers: true,
  showHolyDaysInEvents: false,
  mondayFirst: false,
  showLongerWeekdayNames: false,
  highlightWeekdayNames: true,
  showCopyButtons: false,
  showWesternZodiac: true,
  highlightSunday: true,
  showLunar: true,
  todayTimeZone: 'local',
  notificationsEnabled: false,
  shavingDayReminder: false,
  holidayReminder: true
};

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

class StorageManager {
  getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.showWesternZodiac === undefined && typeof parsed.hideWesternZodiac === 'boolean') {
          parsed.showWesternZodiac = !parsed.hideWesternZodiac;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
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
      return this.getStoredCustomEvents().map(event => event.instant && !event.repeat
        ? { ...event, ...dateTimeInZone(new Date(event.instant), zone) }
        : event);
    } catch (e) {
      console.warn('Error reading custom events:', e);
      return [];
    }
  }

  private getStoredCustomEvents(): CustomEvent[] {
    try {
      const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
      if (raw) {
        const events: CustomEvent[] = JSON.parse(raw);
        return events;
      }
    } catch (e) {
      console.warn('Error reading custom events:', e);
    }
    return [];
  }

  saveCustomEventSync(event: CustomEvent): void {
    const list = this.getStoredCustomEvents();
    const idx = list.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      list[idx] = event;
    } else {
      list.push(event);
    }
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(list));
  }

  deleteCustomEventSync(id: string): void {
    const list = this.getStoredCustomEvents().filter(e => e.id !== id);
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
