// Copyright (c) 2026 RSG-KH | Apache-2.0 License
import database from './time-zones.json';
import type { BirthplaceChoice } from './BirthplaceHierarchy';

let supportedZones: typeof database.zones | undefined;

export function timeZoneChoices(khmer: boolean): BirthplaceChoice<string>[] {
  let localized: Intl.DisplayNames | undefined;
  try { localized = new Intl.DisplayNames([khmer ? 'km' : 'en'], { type: 'region' }); }
  catch { /* The bundled English country names remain available. */ }
  supportedZones ??= database.zones.filter(zone => {
    // Saved zones use the browser's Intl rules; do not offer names it cannot use.
    try { new Intl.DateTimeFormat('en', { timeZone: zone.id }); return true; }
    catch { return false; }
  });
  const choices: BirthplaceChoice<string>[] = [];
  for (const zone of supportedZones) {
    const englishCountry = database.countries[zone.countryCode as keyof typeof database.countries];
    const localCountry = localized?.of(zone.countryCode) ?? englishCountry;
    const city = zone.id.split('/').pop()!.replaceAll('_', ' ');
    choices.push({ key: zone.id, label: zone.id,
      detail: [localCountry, zone.comment].filter(Boolean).join(' · '),
      aliases: [englishCountry, localCountry, zone.countryCode, city, zone.comment ?? ''],
      value: zone.id });
  }
  choices.push({ key: 'UTC', label: 'UTC',
    detail: khmer ? 'ម៉ោងសកល (UTC+00:00)' : 'Coordinated Universal Time (UTC+00:00)',
    aliases: ['Coordinated Universal Time', 'GMT', 'UTC+00:00'], value: 'UTC' });
  return choices.sort((a, b) => a.label.localeCompare(b.label));
}
