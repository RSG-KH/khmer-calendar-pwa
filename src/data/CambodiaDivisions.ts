// Copyright (c) 2026 RSG-KH | Apache-2.0 License
import type { BirthplaceSelection } from './Birthplaces';

export interface CambodiaDivision {
  id: string;
  parentId: string | null;
  level: 1 | 2 | 3;
  nameEn: string;
  nameKm: string;
  latitude: number | null;
  longitude: number | null;
  coordinateConfidence?: 'high' | 'high_for_2018_boundary' | 'medium' | 'low';
}

export interface CambodiaDocument {
  schemaVersion: 1;
  countryCode: 'KH';
  sourceVersion: string;
  sourceSha256: string;
  coordinateFill: {
    sourceSha256: string;
    filledDivisions: number;
    lowConfidenceDivisions: number;
  } | null;
  datasetVersion: string;
  counts: { provinces: number; districts: number; communes: number; total: number };
  divisions: CambodiaDivision[];
}

let dataPromise: Promise<CambodiaDocument> | undefined;

export function cambodiaDivisions(): Promise<CambodiaDocument> {
  return dataPromise ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}birthplaces/cambodia.json.gz`);
    if (!response.ok) throw new Error('Cambodia division data unavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const zipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (zipped && typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot read the bundled birthplace data');
    }
    const text = zipped
      ? await new Response(new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(bytes);
    const document = JSON.parse(text) as CambodiaDocument;
    if (document.schemaVersion !== 1 || document.countryCode !== 'KH' ||
        !/^[0-9a-f]{64}$/.test(document.datasetVersion) || !Array.isArray(document.divisions) ||
        document.divisions.length !== document.counts?.total || document.counts.total < 1000) {
      throw new Error('Invalid Cambodia division data');
    }
    return document;
  })().catch(error => { dataPromise = undefined; throw error; });
}

export function selectionFromDivision(division: CambodiaDivision, document: CambodiaDocument,
                                      khmer: boolean): BirthplaceSelection {
  if (division.level !== 3 || division.latitude === null || division.longitude === null) {
    throw new RangeError('A commune with coordinates is required');
  }
  return { source: 'CambodiaDivisions', divisionId: division.id,
    datasetVersion: document.datasetVersion, label: khmer ? division.nameKm : division.nameEn,
    countryCode: 'KH', latitude: division.latitude, longitude: division.longitude,
    timeZone: 'Asia/Phnom_Penh' };
}
