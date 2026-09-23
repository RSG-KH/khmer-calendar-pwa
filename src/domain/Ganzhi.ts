// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { getDayPillar, getHourPillar, getMonthPillar, getYearPillar, type EarthlyBranch, type GanzhiPillar } from 'khmer-calendar-engine';

export interface GanzhiColumn {
  key: 'year' | 'month' | 'day' | 'hour';
  pillar: GanzhiPillar | null;
}

/**
 * Return pillars in the certified year, month, day order, plus an optional hour.
 * Solar year/month pillars are unavailable outside 1900–2100; day/hour remain available.
 * See docs/maintainer-certified-calendar-ui.md before changing the PWA presentation.
 */
export function ganzhiColumns(year: number, month: number, day: number, hourOfDay?: number): GanzhiColumn[] {
  const solarSupported = year >= 1900 && year <= 2100;
  const columns: GanzhiColumn[] = [
    { key: 'year', pillar: solarSupported ? getYearPillar(year, month, day) : null },
    { key: 'month', pillar: solarSupported ? getMonthPillar(year, month, day) : null },
    { key: 'day', pillar: getDayPillar(year, month, day) }
  ];
  if (hourOfDay !== undefined) {
    columns.push({ key: 'hour', pillar: getHourPillar(year, month, day, hourOfDay) });
  }
  return columns;
}

/** Maintainer-certified Earthly Branch emoji order, Rat (0) through Pig (11). */
const ANIMAL_EMOJI = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐐', '🐵', '🐔', '🐶', '🐷'];

export function ganzhiAnimalLabel(branch: EarthlyBranch, khmer: boolean, useEmoji: boolean): string {
  return useEmoji ? ANIMAL_EMOJI[branch.index]
    : khmer ? branch.khmerAnimal.split(' (')[0] : branch.animal;
}

/**
 * Maintainer-certified summary line: `☯️ 干支 (🐴🐔🐭 x 🐭🐰🐴)` on 2026-09-11.
 * Always use emoji, independently of the detail table's emoji/name setting.
 * Return null unless the year, month and day pillars are all available.
 * Keep the year–month–day order and exact ` x ` separator during Android sync.
 */
export function ganzhiEmojiSummary(year: number, month: number, day: number): string | null {
  const pillars = ganzhiColumns(year, month, day).flatMap(({ pillar }) => pillar ? [pillar] : []);
  if (pillars.length !== 3) return null;
  const animals = pillars.map(pillar => ganzhiAnimalLabel(pillar.branch, false, true)).join('');
  const clashes = pillars.map(pillar => ganzhiAnimalLabel(pillar.clashBranch, false, true)).join('');
  return `☯️ 干支 (${animals} x ${clashes})`;
}
