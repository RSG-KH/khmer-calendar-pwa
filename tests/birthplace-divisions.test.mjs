import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false },
  appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { validBirthplace, DEFAULT_RISING_PLACE } = await server.ssrLoadModule('/src/data/Birthplaces.ts');
const { selectionFromDivision } = await server.ssrLoadModule('/src/data/CambodiaDivisions.ts');
const { selectionFromGeoNamesDivision } = await server.ssrLoadModule('/src/data/GeoNamesDivisions.ts');
const index = JSON.parse(readFileSync(new URL('../public/birthplaces/country-index.json', import.meta.url)));
const provenance = JSON.parse(readFileSync(new URL('../public/birthplaces/provenance.json', import.meta.url)));
const readAsset = path => JSON.parse(gunzipSync(readFileSync(new URL(`../public/birthplaces/${path}`, import.meta.url))));

test('Cambodia has its complete three-level tree and all missing points are filled by matching ID', () => {
  const document = readAsset('cambodia.json.gz');
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.countryCode, 'KH');
  assert.deepEqual([1, 2, 3].map(level => document.divisions.filter(d => d.level === level).length),
    [25, 210, 1663]);
  assert.equal(document.divisions.filter(d => d.latitude === null).length, 0);
  assert.equal(document.divisions.filter(d => d.coordinateConfidence).length, 445);
  assert.equal(document.divisions.filter(d => d.coordinateConfidence === 'low').length, 6);
  assert.equal(document.coordinateFill.filledDivisions, 445);
  assert.equal(document.coordinateFill.sourceSha256,
    '37b6762eb8c8fd276796beff44f52436253693751f91e5a6ead22262bbdafb73');
  assert.equal(provenance.cambodia.datasetVersion, document.datasetVersion);
  assert.equal(provenance.cambodia.withCoordinates, 1898);
  const byId = new Map(document.divisions.map(d => [d.id, d]));
  assert.equal(byId.size, 1898);
  for (const division of document.divisions) {
    assert.equal(division.latitude === null, division.longitude === null);
    if (division.level === 1) assert.equal(division.parentId, null);
    else assert.equal(byId.get(division.parentId)?.level, division.level - 1);
  }
  const olympic = document.divisions.find(d => d.nameEn === 'Sangkat Olympic');
  const place = selectionFromDivision(olympic, document, true);
  assert.equal(place.label, 'សង្កាត់ អូឡាំពិក');
  assert.equal(place.timeZone, 'Asia/Phnom_Penh');
  assert.equal(validBirthplace(place), true);
  const previouslyMissing = document.divisions.find(d => d.id === '0c3366f5-a7ea-46e0-9c65-78cc1d1e5c7f');
  assert.deepEqual([previouslyMissing.latitude, previouslyMissing.longitude], [11.5638737, 104.9172899]);
  assert.equal(validBirthplace(selectionFromDivision(previouslyMissing, document, false)), true);
  assert.throws(() => selectionFromDivision(document.divisions.find(d => d.level === 2),
    document, false), RangeError);
  const voatPhnum = byId.get('018ae4a2-6397-49c9-8e5d-f5e0adabff2b');
  assert.equal(byId.get(voatPhnum.parentId)?.nameEn, 'Khan Doun Penh');
  assert.equal(byId.get(byId.get(voatPhnum.parentId).parentId)?.nameEn, 'Phnom Penh Capital');
  assert.deepEqual(DEFAULT_RISING_PLACE, selectionFromDivision(voatPhnum, document, false));
  assert.equal(validBirthplace(DEFAULT_RISING_PLACE), true);
});

test('all shipped GeoNames shards contain linked ADM1–ADM3 points and no city records', () => {
  assert.equal(index.schemaVersion, 3);
  assert.ok(index.countries.length >= 200);
  assert.equal(index.countries.find(country => country.code === 'KH').divisionCount, 1898);
  const totals = [0, 0, 0];
  let withoutTimeZone = 0;
  for (const country of index.countries.filter(country => country.code !== 'KH')) {
    const document = readAsset(`countries/${country.code}.json.gz`);
    assert.equal(document.schemaVersion, 3);
    assert.equal(document.countryCode, country.code);
    assert.equal(document.divisions.length, country.divisionCount);
    const byId = new Map(document.divisions.map(d => [d.id, d]));
    assert.equal(byId.size, document.divisions.length, `${country.code}: unique GeoNames IDs`);
    for (const division of document.divisions) {
      assert.ok([1, 2, 3].includes(division.level));
      assert.ok(Number.isFinite(division.latitude) && Math.abs(division.latitude) <= 90);
      assert.ok(Number.isFinite(division.longitude) && Math.abs(division.longitude) <= 180);
      if (division.level === 1) assert.equal(division.parentId, null);
      else assert.equal(byId.get(division.parentId)?.level, division.level - 1,
        `${country.code}: ${division.id} parent`);
      totals[division.level - 1]++;
      if (!division.timeZone) withoutTimeZone++;
    }
  }
  assert.deepEqual(totals, index.statistics.byLevel);
  assert.equal(withoutTimeZone, index.statistics.withoutTimeZone);
  const belgium = readAsset('countries/BE.json.gz');
  const division = belgium.divisions.find(d => d.level === 3 && d.timeZone === 'Europe/Brussels');
  const place = selectionFromGeoNamesDivision(division, belgium);
  assert.equal(place.source, 'GeoNamesAdmin');
  assert.equal(validBirthplace(place), true);
  const ukraine = readAsset('countries/UA.json.gz');
  assert.throws(() => selectionFromGeoNamesDivision(
    ukraine.divisions.find(d => !d.timeZone), ukraine), RangeError);
});
