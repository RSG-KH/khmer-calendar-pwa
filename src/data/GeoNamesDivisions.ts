// Copyright (c) 2026 RSG-KH | Apache-2.0 License
import type { BirthplaceSelection } from './Birthplaces';

export interface GeoNamesDivision {
  id: number;
  parentId: number | null;
  level: 1 | 2 | 3;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

export interface GeoNamesDivisionDocument {
  schemaVersion: 3;
  countryCode: string;
  datasetVersion: string;
  divisions: GeoNamesDivision[];
}

export interface GeoNamesCountry {
  code: string;
  name: string;
  divisionCount: number;
}

const base = `${import.meta.env.BASE_URL}birthplaces/`;
let indexPromise: Promise<GeoNamesCountry[]> | undefined;
const countryPromises = new Map<string, Promise<GeoNamesDivisionDocument>>();

export function divisionCountries(): Promise<GeoNamesCountry[]> {
  return indexPromise ??= fetch(`${base}country-index.json`).then(async response => {
    if (!response.ok) throw new Error('Division country index unavailable');
    const index = await response.json();
    if (index.schemaVersion !== 3 || !Array.isArray(index.countries)) {
      throw new Error('Invalid division country index');
    }
    return index.countries as GeoNamesCountry[];
  }).catch(error => { indexPromise = undefined; throw error; });
}

export function geonamesDivisions(code: string): Promise<GeoNamesDivisionDocument> {
  if (!/^[A-Z]{2}$/.test(code) || code === 'KH') {
    return Promise.reject(new RangeError('Invalid GeoNames division country'));
  }
  let promise = countryPromises.get(code);
  if (!promise) {
    promise = (async () => {
      const response = await fetch(`${base}countries/${code}.json.gz`);
      if (!response.ok) throw new Error('Division data unavailable');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const zipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
      if (zipped && typeof DecompressionStream === 'undefined') {
        throw new Error('This browser cannot read the bundled birthplace data');
      }
      const text = zipped
        ? await new Response(new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes);
      const document = JSON.parse(text) as GeoNamesDivisionDocument;
      if (document.schemaVersion !== 3 || document.countryCode !== code ||
          !/^[0-9a-f]{64}$/.test(document.datasetVersion) || !Array.isArray(document.divisions)) {
        throw new Error('Invalid GeoNames division data');
      }
      return document;
    })().catch(error => {
      // An evicted request can fail after a newer request for this country starts.
      if (countryPromises.get(code) === promise) countryPromises.delete(code);
      throw error;
    });
  }
  countryPromises.delete(code);
  countryPromises.set(code, promise);
  if (countryPromises.size > 2) countryPromises.delete(countryPromises.keys().next().value!);
  return promise;
}

export function selectionFromGeoNamesDivision(division: GeoNamesDivision,
    document: GeoNamesDivisionDocument): BirthplaceSelection {
  if (!division.timeZone) throw new RangeError('Administrative time zone unavailable');
  try { new Intl.DateTimeFormat('en', { timeZone: division.timeZone }); }
  catch { throw new RangeError('Administrative time zone unsupported'); }
  return { source: 'GeoNamesAdmin', geonameId: division.id,
    datasetVersion: document.datasetVersion, label: division.name,
    countryCode: document.countryCode, latitude: division.latitude,
    longitude: division.longitude, timeZone: division.timeZone };
}
