import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false },
  appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const bytes = gunzipSync(readFileSync(new URL('../public/birthplaces/cambodia.json.gz', import.meta.url)));
const catalog = JSON.parse(bytes);
let renderSettings, DEFAULT_SETTINGS, cambodiaDivisions, selectionFromDivision;

beforeEach(async () => {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Node', platform: 'Win32' }, configurable: true });
  globalThis.window = { matchMedia: () => Object.assign(new EventTarget(), { matches: false }) };
  server.moduleGraph.invalidateAll();
  ({ renderSettings } = await server.ssrLoadModule('/src/ui/Settings.ts'));
  ({ DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts'));
  ({ cambodiaDivisions, selectionFromDivision } = await server.ssrLoadModule('/src/data/CambodiaDivisions.ts'));
});

function fixture(settings) {
  class Element extends EventTarget {
    textContent = '';
    setAttribute() {}
  }
  const nodes = new Map();
  const container = {
    set innerHTML(html) {
      nodes.clear();
      const label = html.match(/id="rising-place-value">([^<]*)<\/span>/)?.[1];
      if (label !== undefined) nodes.set('#rising-place-value', Object.assign(new Element(), { textContent: label }));
    },
    querySelector(selector) {
      if (selector === '#rising-place-value') return nodes.get(selector) ?? null;
      if (!nodes.has(selector)) nodes.set(selector, new Element());
      return nodes.get(selector);
    },
    querySelectorAll() { return []; }
  };
  let writes = 0;
  const cleanup = renderSettings(container, settings, () => writes++, {
    subscribe(callback) { callback('idle'); return () => {}; }, check() {}
  });
  return { cleanup, label: nodes.get('#rising-place-value'), get writes() { return writes; } };
}

function mockCatalog(t) {
  return t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, `${server.config.base}birthplaces/cambodia.json.gz`);
    return new Response(bytes);
  });
}

test('Settings translates default and saved Cambodian locations in both UI languages without changing the selection', async t => {
  const fetch = mockCatalog(t);
  const olympic = catalog.divisions.find(division => division.nameEn === 'Sangkat Olympic');
  const places = [DEFAULT_SETTINGS.risingPlace,
    selectionFromDivision(olympic, catalog, false), selectionFromDivision(olympic, catalog, true)];
  for (const saved of places) {
    const place = Object.freeze(JSON.parse(JSON.stringify(saved)));
    const original = JSON.stringify(place);
    const division = catalog.divisions.find(item => item.id === place.divisionId);
    for (const language of ['km', 'en', 'km']) {
      const view = fixture({ ...DEFAULT_SETTINGS, language, risingPlace: place });
      try {
        await cambodiaDivisions();
        assert.equal(view.label.textContent, language === 'km' ? division.nameKm : division.nameEn);
        assert.equal(JSON.stringify(place), original);
        assert.equal(view.writes, 0, 'display translation must not save preferences');
      } finally { view.cleanup(); }
    }
  }
  assert.equal(fetch.mock.callCount(), 1, 'language changes reuse the picker catalog');
});

test('custom/global locations and hidden astrology rows do not load the Cambodian catalog', t => {
  const fetch = mockCatalog(t);
  for (const patch of [
    { risingPlace: { ...DEFAULT_SETTINGS.risingPlace, source: 'manual', label: 'My Cambodian home' } },
    { risingPlace: { source: 'GeoNamesAdmin', label: 'Arrondissement de Mons', countryCode: 'BE' } },
    { enableAstrologyAndZodiac: false },
    { showWesternZodiac: false }
  ]) {
    const settings = { ...DEFAULT_SETTINGS, ...patch };
    const view = fixture(settings);
    if (view.label) assert.equal(view.label.textContent, settings.risingPlace.label);
    else assert.ok(!settings.enableAstrologyAndZodiac || !settings.showWesternZodiac);
    view.cleanup();
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('an unavailable division retains its saved name', async t => {
  mockCatalog(t);
  const view = fixture({ ...DEFAULT_SETTINGS, risingPlace: { ...DEFAULT_SETTINGS.risingPlace,
    divisionId: '00000000-0000-0000-0000-000000000000', label: 'Saved place' } });
  try {
    await cambodiaDivisions();
    assert.equal(view.label.textContent, 'Saved place');
    assert.equal(view.writes, 0);
  } finally { view.cleanup(); }
});

test('a failed catalog load keeps the saved name and can retry when Settings reopens', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Offline'); });
  const failed = fixture(DEFAULT_SETTINGS);
  await assert.rejects(cambodiaDivisions(), /Offline/);
  await new Promise(setImmediate);
  assert.equal(failed.label.textContent, DEFAULT_SETTINGS.risingPlace.label);
  failed.cleanup();
  fetch.mock.mockImplementation(async () => new Response(bytes));
  const retried = fixture(DEFAULT_SETTINGS);
  try {
    await cambodiaDivisions();
    assert.equal(retried.label.textContent,
      catalog.divisions.find(item => item.id === DEFAULT_SETTINGS.risingPlace.divisionId).nameKm);
    assert.equal(fetch.mock.callCount(), 2);
  } finally { retried.cleanup(); }
});

test('a delayed lookup cannot update a disposed Settings row or overwrite the new language/location', async t => {
  let resolveFetch;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { resolveFetch = resolve; }));
  const old = fixture(DEFAULT_SETTINGS);
  old.cleanup();
  const olympic = catalog.divisions.find(division => division.nameEn === 'Sangkat Olympic');
  const current = fixture({ ...DEFAULT_SETTINGS, language: 'en',
    risingPlace: selectionFromDivision(olympic, catalog, true) });
  try {
    assert.equal(fetch.mock.callCount(), 1);
    resolveFetch(new Response(bytes));
    await cambodiaDivisions();
    assert.equal(old.label.textContent, DEFAULT_SETTINGS.risingPlace.label, 'disposed row must stay untouched');
    assert.equal(current.label.textContent, olympic.nameEn);
    assert.equal(old.writes + current.writes, 0);
  } finally { current.cleanup(); }
});
