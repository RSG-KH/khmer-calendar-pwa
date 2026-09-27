// Copyright (c) 2026 RSG-KH | Apache-2.0 License
import defaultRisingPlace from './default-rising-place.json';

export interface BirthplaceSelection {
  source: 'GeoNames' | 'GeoNamesAdmin' | 'CambodiaDivisions' | 'manual';
  geonameId?: number;
  divisionId?: string;
  datasetVersion?: string;
  label: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

export const DEFAULT_RISING_PLACE: BirthplaceSelection = defaultRisingPlace as BirthplaceSelection;

export function validBirthplace(value: unknown): value is BirthplaceSelection {
  if (!value || typeof value !== 'object') return false;
  const place = value as Partial<BirthplaceSelection>;
  let supportedZone = false;
  if (typeof place.timeZone === 'string') {
    try { new Intl.DateTimeFormat('en', { timeZone: place.timeZone }); supportedZone = true; }
    catch { /* A saved place cannot use timezone rules this browser does not have. */ }
  }
  return supportedZone && (place.source === 'GeoNames' || place.source === 'GeoNamesAdmin' ||
    place.source === 'CambodiaDivisions' || place.source === 'manual') &&
    typeof place.label === 'string' && place.label.length > 0 && place.label.length <= 160 &&
    typeof place.timeZone === 'string' && place.timeZone.length > 0 && place.timeZone.length <= 100 &&
    typeof place.latitude === 'number' && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90 &&
    typeof place.longitude === 'number' && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180 &&
    (place.geonameId === undefined || Number.isSafeInteger(place.geonameId) && place.geonameId > 0) &&
    (place.source === 'manual' || typeof place.datasetVersion === 'string' &&
      /^[0-9a-f]{64}$/.test(place.datasetVersion)) &&
    ((place.source !== 'GeoNames' && place.source !== 'GeoNamesAdmin') || Number.isSafeInteger(place.geonameId)) &&
    (place.source !== 'CambodiaDivisions' || /^[0-9a-f-]{36}$/.test(place.divisionId ?? '') &&
      place.countryCode === 'KH') &&
    (place.countryCode === undefined || /^[A-Z]{2}$/.test(place.countryCode));
}
