import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const input = process.argv[2];
if (!input) throw new Error('Pass the path to runtime/divisions.min.json from the Cambodia dataset.');
const raw = await readFile(input);
const source = JSON.parse(raw);
const counts = source.metadata?.counts;
if (source.metadata?.schema_version !== '2.0.0' || source.metadata?.country_code !== 'KH' ||
    !counts || source.divisions?.length !== counts.total || counts.total < 1000) {
  throw new Error('Unexpected Cambodia division dataset.');
}

const missing = source.divisions.filter(record => record.latitude === null && record.longitude === null);
const fillPath = process.argv[3];
if (missing.length && !fillPath) {
  throw new Error(`Pass the filled-coordinate JSON bundle for ${missing.length} missing divisions.`);
}
const fillRaw = fillPath ? await readFile(fillPath) : null;
const fillDocument = fillRaw ? JSON.parse(fillRaw) : null;
const fills = fillDocument?.records ?? [];
const sourceById = new Map(source.divisions.map(record => [record.id, record]));
const fillById = new Map();
if (fillDocument && (fillDocument.count !== fills.length || !Array.isArray(fills) ||
    fillDocument.coordinate_fill_summary?.remaining_without_coordinates !== 0)) {
  throw new Error('Invalid filled-coordinate bundle summary.');
}
for (const fill of fills) {
  const original = sourceById.get(fill.id);
  if (!original || fillById.has(fill.id) || original.latitude !== null || original.longitude !== null ||
      ['parent_id', 'level', 'name_en', 'name_km', 'postal_code', 'geocode'].some(key =>
        fill[key] !== original[key]) ||
      fill.coordinate_status_original !== original.coordinate_status ||
      !Array.isArray(fill.path_ids) || fill.path_ids.at(-1) !== fill.id ||
      fill.path_ids.at(-2) !== fill.parent_id ||
      !Number.isFinite(fill.latitude) || !Number.isFinite(fill.longitude) ||
      fill.latitude < 9 || fill.latitude > 15 || fill.longitude < 102 || fill.longitude > 108 ||
      !['high', 'high_for_2018_boundary', 'medium', 'low'].includes(fill.coordinate_confidence) ||
      !fill.coordinate_source || !fill.coordinate_kind || !fill.coordinate_note) {
    throw new Error(`Invalid coordinate fill for ${fill.id}`);
  }
  fillById.set(fill.id, fill);
}
if (fillById.size !== missing.length || missing.some(record => !fillById.has(record.id))) {
  throw new Error('Filled-coordinate bundle does not exactly cover the missing divisions.');
}

const divisions = source.divisions.map(record => {
  if (![1, 2, 3].includes(record.level) || !record.id || !record.name_en || !record.name_km ||
      (record.latitude === null) !== (record.longitude === null)) {
    throw new Error(`Invalid division ${record.id}`);
  }
  const fill = fillById.get(record.id);
  return {
    id: record.id, parentId: record.parent_id, level: record.level,
    nameEn: record.name_en, nameKm: record.name_km,
    latitude: fill?.latitude ?? record.latitude, longitude: fill?.longitude ?? record.longitude,
    ...(fill ? { coordinateConfidence: fill.coordinate_confidence } : {})
  };
});
const ids = new Set(divisions.map(record => record.id));
if (ids.size !== divisions.length || divisions.some(record => record.level === 1
  ? record.parentId !== null : !ids.has(record.parentId))) {
  throw new Error('Duplicate IDs or broken Cambodia division hierarchy.');
}
if ([counts.provinces, counts.districts, counts.communes].some((expected, index) =>
  divisions.filter(record => record.level === index + 1).length !== expected)) {
  throw new Error('Cambodia division counts do not match metadata.');
}
const sourceSha256 = createHash('sha256').update(raw).digest('hex');
const coordinateFillSha256 = fillRaw ? createHash('sha256').update(fillRaw).digest('hex') : null;
const datasetVersion = createHash('sha256').update(raw).update(fillRaw ?? '').digest('hex');
const defaultDivisionId = '018ae4a2-6397-49c9-8e5d-f5e0adabff2b';
const defaultDivision = divisions.find(division => division.id === defaultDivisionId);
const defaultDistrict = defaultDivision && sourceById.get(defaultDivision.parentId);
const defaultCapital = defaultDistrict && sourceById.get(defaultDistrict.parent_id);
if (defaultDivision?.nameEn !== 'Sangkat Voat Phnum' ||
    defaultDistrict?.name_en !== 'Khan Doun Penh' ||
    defaultCapital?.name_en !== 'Phnom Penh Capital' ||
    !Number.isFinite(defaultDivision.latitude) || !Number.isFinite(defaultDivision.longitude)) {
  throw new Error('The certified default Rising location is missing or has changed identity.');
}
const defaultPlace = { source: 'CambodiaDivisions', divisionId: defaultDivision.id,
  datasetVersion, label: defaultDivision.nameEn, countryCode: 'KH',
  latitude: defaultDivision.latitude, longitude: defaultDivision.longitude,
  timeZone: 'Asia/Phnom_Penh' };
const coordinateFill = fillDocument ? {
  sourceSha256: coordinateFillSha256, filledDivisions: fills.length,
  methodBreakdown: fillDocument.coordinate_fill_summary.method_breakdown,
  lowConfidenceDivisions: fills.filter(fill => fill.coordinate_confidence === 'low').length
} : null;
const data = Buffer.from(JSON.stringify({ schemaVersion: 1, countryCode: 'KH',
  sourceVersion: source.metadata.dataset_version, sourceSha256, coordinateFill,
  datasetVersion, counts, divisions }));
const output = new URL('../public/birthplaces/cambodia.json.gz', import.meta.url);
await writeFile(output, gzipSync(data, { level: 9, mtime: 0 }));
await writeFile(new URL('../src/data/default-rising-place.json', import.meta.url),
  JSON.stringify(defaultPlace) + '\n');
const provenancePath = new URL('../public/birthplaces/provenance.json', import.meta.url);
const provenance = JSON.parse(await readFile(provenancePath));
provenance.cambodia = {
  ...provenance.cambodia,
  source: fillDocument ? 'Wikipedia-referenced Cambodia divisions with supplemental CambodiaPostalCode records, Open Admin Data and additional coordinate points'
    : 'Wikipedia-referenced Cambodia divisions with supplemental CambodiaPostalCode records and Open Admin Data coordinates',
  sourceVersion: source.metadata.dataset_version, sourceSha256, datasetVersion,
  divisions: divisions.length,
  withCoordinates: divisions.filter(division => division.latitude !== null).length,
  coordinateFill,
  sourceNotice: 'See ATTRIBUTION.txt and the source dataset NOTICE.md'
};
await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
console.log(`Imported ${divisions.length} Cambodia divisions (${data.length} JSON bytes; ` +
  `${fills.length} supplementary coordinates).`);
