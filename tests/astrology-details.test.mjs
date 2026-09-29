import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { astrologyBackground, astrologySearchQuery, bindAstrologyTable } = await server.ssrLoadModule('/src/ui/AstrologyDetails.ts');
const { westernZodiacColumns } = await server.ssrLoadModule('/src/domain/WesternZodiac.ts');
const { ganzhiColumns } = await server.ssrLoadModule('/src/domain/Ganzhi.ts');
const { DateDetailsDialogModal } = await server.ssrLoadModule('/src/ui/Modals.ts');
const { Storage, DEFAULT_SETTINGS } = await server.ssrLoadModule('/src/data/Storage.ts');

function fixture() {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  class Target extends EventTarget {
    listeners = new Map();
    addEventListener(type, handler, options) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
      super.addEventListener(type, handler, options);
    }
    removeEventListener(type, handler, options) {
      this.listeners.get(type)?.delete(handler);
      super.removeEventListener(type, handler, options);
    }
    get count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  }
  const attached = [];
  class Element extends Target {
    nodes = new Map(); attributes = new Map(); classes = new Set(); dataset = {}; isConnected = true;
    style = { setProperty() {}, removeProperty() {} };
    classList = { add: key => this.classes.add(key), remove: key => this.classes.delete(key),
      contains: key => this.classes.has(key), toggle: (key, enabled) => enabled ? this.classes.add(key) : this.classes.delete(key) };
    _html = '';
    get innerHTML() { return this._html; }
    set innerHTML(value) { this._html = value; this.nodes.clear(); }
    querySelector(selector) {
      if (!this.nodes.has(selector)) {
        const node = new Element();
        if (selector.includes('table-wrap')) Object.defineProperty(node, 'outerHTML', { set: value => {
          const name = selector.startsWith('.western') ? 'western-zodiac-table-wrap' : 'ganzhi-table-wrap';
          this._html = this._html.replace(new RegExp(`<div class="${name}">[\\s\\S]*?<\\/table>(\\s*<p[^>]*>.*?<\\/p>)?\\s*<\\/div>`), value);
        } });
        this.nodes.set(selector, node);
      }
      return this.nodes.get(selector);
    }
    querySelectorAll(selector) {
      if (selector !== '.astrology-table-trigger') return [];
      return [...this._html.matchAll(/data-astrology="(big3|ganzhi)"/g)].map(([, kind]) => {
        const element = this.querySelector(`[data-astrology="${kind}"]`);
        element.dataset.astrology = kind;
        return element;
      });
    }
    setAttribute(key, value) { this.attributes.set(key, value); }
    focus() { doc.activeElement = this; }
    contains(element) { return element === this || [...this.nodes.values()].some(node => node.contains(element)); }
    remove() { this.isConnected = false; const index = attached.indexOf(this); if (index >= 0) attached.splice(index, 1); }
  }
  const app = new Element();
  const doc = Object.assign(new Target(), { activeElement: app,
    createElement: () => new Element(), getElementById: () => app, querySelector: () => null,
    querySelectorAll: () => attached.filter(element => element.classList.contains('open')),
    body: { appendChild(element) { const i = attached.indexOf(element); if (i >= 0) attached.splice(i, 1); attached.push(element); } } });
  const viewport = Object.assign(new Target(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
  const opened = [], alerts = [];
  const host = Object.assign(new Target(), { innerWidth: 390, innerHeight: 844, visualViewport: viewport,
    open(url) { const result = {}; opened.push({ url, result }); return result; }, alert: value => alerts.push(value),
    setTimeout, clearTimeout });
  globalThis.HTMLElement = Element; globalThis.document = doc; globalThis.window = host;
  return { Element, doc, attached, host, viewport, opened, alerts };
}

function fire(target, type, values = {}) {
  const event = new Event(type, { cancelable: true });
  if (type.startsWith('pointer')) Object.assign(event, { button: 0, isPrimary: true });
  Object.assign(event, values);
  target.dispatchEvent(event);
  return event;
}

test('table activation handles hover, click and keyboard without treating scrolling as a click', () => {
  const { Element } = fixture(); const element = new Element(); let opens = 0;
  bindAstrologyTable(element, () => opens++);
  fire(element, 'pointermove', { clientX: 120, clientY: 40 });
  fire(element, 'click', { detail: 1 });
  assert.equal(opens, 1, 'Moving a mouse over the table must not block a normal click');
  fire(element, 'pointerdown', { clientX: 180, clientY: 40 });
  assert.equal(element.classList.contains('is-pressed'), true, 'Touch down must highlight the whole table');
  fire(element, 'pointermove', { clientX: 40, clientY: 40 });
  assert.equal(element.classList.contains('is-pressed'), false, 'Scrolling must clear the touch highlight');
  fire(element, 'pointerup');
  assert.equal(fire(element, 'click', { detail: 1 }).defaultPrevented, true);
  assert.equal(opens, 1);
  fire(element, 'pointerdown', { clientX: 40, clientY: 40 });
  fire(element, 'pointercancel');
  assert.equal(element.classList.contains('is-pressed'), false);
  fire(element, 'click', { detail: 1 });
  assert.equal(opens, 1);
  fire(element, 'pointerdown', { clientX: 40, clientY: 40 });
  fire(element, 'pointerleave');
  assert.equal(element.classList.contains('is-pressed'), false, 'Leaving the table must clear the highlight');
  fire(element, 'click', { detail: 1 });
  assert.equal(opens, 1);
  fire(element, 'pointerdown', { clientX: 40, clientY: 40 });
  fire(element, 'pointermove', { clientX: 42, clientY: 41 });
  assert.equal(element.classList.contains('is-pressed'), true, 'Small finger movement must retain feedback');
  fire(element, 'pointerup');
  assert.equal(element.classList.contains('is-pressed'), false);
  fire(element, 'click', { detail: 1 });
  assert.equal(opens, 2, 'A fresh tap after a cancelled gesture must still open the popup');
  fire(element, 'pointerdown', { clientX: 40, clientY: 40, button: 2 });
  assert.equal(element.classList.contains('is-pressed'), false, 'A secondary click must not show touch feedback');
  fire(element, 'pointerdown', { clientX: 40, clientY: 40, isPrimary: false });
  assert.equal(element.classList.contains('is-pressed'), false);
  for (const key of ['Enter', ' ']) assert.equal(fire(element, 'keydown', { key, repeat: false }).defaultPrevented, true);
  fire(element, 'keydown', { key: 'Enter', repeat: true });
  assert.equal(opens, 4, 'Held keys must not open multiple popups');
});

test('backgrounds use calculated Sun and solar Year, with unavailable values omitted from AI queries', () => {
  const western = westernZodiacColumns({ year: 2026, month: 11, day: 10 });
  const ganzhi = ganzhiColumns(2026, 3, 1, 12);
  const details = { kind: 'big3', khmer: false, western, ganzhi, tableHtml: '' };
  assert.ok(astrologyBackground(details).endsWith('western_zodiac_scorpio.png'));
  assert.ok(astrologyBackground({ ...details, kind: 'ganzhi' }).endsWith('zodiac_horse_400.png'));
  assert.match(astrologySearchQuery(details), /Sun: Scorpio/);
  assert.doesNotMatch(astrologySearchQuery(details), /Rising:|2026|latitude|longitude/);
  const outsideSolar = { ...details, kind: 'ganzhi', ganzhi: ganzhiColumns(1850, 1, 1) };
  assert.equal(astrologyBackground(outsideSolar), undefined);
  assert.match(astrologySearchQuery(outsideSolar), /Day:/);
  assert.doesNotMatch(astrologySearchQuery(outsideSolar), /Year:|Month:|Hour:|1850/);
});

test('both popup tables reuse updated time/place results and language/emoji choices, and Ask AI preserves them', () => {
  for (const khmer of [false, true]) {
    const f = fixture();
    Storage.saveSettings({ ...DEFAULT_SETTINGS, khmer, useEmojiForWesternZodiac: khmer, useEmojiForGanzhiAnimals: khmer });
    const parent = new DateDetailsDialogModal(() => {}, () => {});
    parent.open('2026-09-24', [], khmer);
    parent.setTime('08:35');
    const table = html => html.match(/<table[\s\S]*?<\/table>/)?.[0];
    const before = parent.overlay.innerHTML;
    for (const kind of ['big3', 'ganzhi']) {
      const trigger = parent.overlay.querySelector(`[data-astrology="${kind}"]`);
      fire(trigger, 'click', { detail: 0 });
      const child = f.attached.at(-1);
      assert.equal(child.classList.contains('open'), true);
      assert.equal(f.doc.activeElement, child);
      const expected = before.match(new RegExp(`<div class="${kind === 'big3' ? 'western-zodiac' : 'ganzhi'}-table-wrap">[\\s\\S]*?<\\/table>`))[0];
      assert.equal(table(child.innerHTML), table(expected));
      assert.equal((child.innerHTML.match(/class="astrology-sign-detail"/g) ?? []).length, kind === 'big3' ? 3 : 0);
      if (kind === 'big3') assert.match(child.innerHTML, /♎️ Libra \(Air · Venus\)/);
      assert.match(child.innerHTML, khmer ? /សួរ AI/ : /Ask AI/);
      assert.match(child.innerHTML, khmer
        ? /គណនាដោយ Khmer Calendar Engine កំណែ 0\.6\.0/
        : /Calculations by Khmer Calendar Engine v0\.6\.0/);
      assert.doesNotMatch(child.innerHTML, /role="button"|data-astrology=/);
      child.querySelector('.btn-ask-ai').dispatchEvent(new Event('click'));
      const { url, result } = f.opened.at(-1); const parsed = new URL(url);
      assert.equal(parsed.searchParams.get('udm'), '50');
      const query = parsed.searchParams.get('q');
      if (khmer) {
        assert.match(query, /២០២៦/);
        if (kind === 'big3') {
          assert.match(query, /ម៉ោង ០៨:៣៥ \(ទីតាំងមិនបានបញ្ជាក់\)៖/);
          assert.match(query, /- ព្រះអាទិត្យ \(Sun\)៖ Libra/);
        } else {
          assert.match(query, /ម៉ោង ៨ និង ៣៥ នាទី៖/);
          assert.match(query, /- ឆ្នាំ៖ 丙午/);
        }
      } else {
        assert.match(query, /September 24, 2026, at 08:35/);
        if (kind === 'big3') {
          assert.match(query, /\(unspecified location\):/);
          assert.match(query, /- Sun: Libra;/);
        } else {
          assert.match(query, /- Year: 丙午/);
        }
      }
      assert.doesNotMatch(query, /Voat|11\.574/);
      assert.equal(result.opener, null);
      assert.equal(child.classList.contains('open'), true);
      child.querySelector('.btn-astrology-close').dispatchEvent(new Event('click'));
      assert.equal(parent.overlay.innerHTML, before);
      assert.equal(parent.customTime, '08:35');
      assert.equal(f.doc.activeElement, trigger);
    }
    parent.close();
    assert.equal(f.attached.length, 1, 'The child overlay is removed with its parent');
    assert.equal(f.host.count, 0); assert.equal(f.viewport.count, 0);
  }
});

test('repeated open/close and parent replacement release child overlays and viewport listeners', () => {
  const f = fixture(); const parent = new DateDetailsDialogModal(() => {}, () => {});
  for (let cycle = 0; cycle < 12; cycle++) {
    parent.open('2026-09-24', [], false);
    fire(parent.overlay.querySelector('[data-astrology="big3"]'), 'click', { detail: 0 });
    assert.equal(f.attached.length, 2);
    if (cycle % 2) parent.open('2026-09-25', [], true);
    parent.close();
    assert.equal(f.attached.length, 1);
    assert.equal(f.host.count, 0); assert.equal(f.viewport.count, 0);
    assert.equal(parent.overlay.innerHTML, '');
  }
});

test('astrology AI queries format Ganzhi and Big 3 with date, time, and structured list items', () => {
  const ganzhi = ganzhiColumns(2026, 9, 29, 20);
  const western = [
    { key: 'sun', sign: { englishName: 'Libra' } },
    { key: 'moon', sign: { englishName: 'Taurus' } },
    { key: 'rising', sign: { englishName: 'Gemini' } }
  ];

  const ganzhiEn = astrologySearchQuery({
    kind: 'ganzhi',
    khmer: false,
    tableHtml: '',
    western: [],
    ganzhi,
    date: { year: 2026, month: 9, day: 29 },
    time: '20:58'
  });
  const expectedGanzhiEn = 'Please explain the traditional astrological meanings of the Chinese Ganzhi (干支) for September 29, 2026, at 20:58:\n'
    + '- Year: 丙午 Horse (Clash: Rat);\n'
    + '- Month: 丁酉 Rooster (Clash: Rabbit);\n'
    + '- Day: 丙午 Horse (Clash: Rat);\n'
    + '- Hour: 戊戌 Dog (Clash: Dragon).';
  assert.equal(ganzhiEn, expectedGanzhiEn);

  const ganzhiKm = astrologySearchQuery({
    kind: 'ganzhi',
    khmer: true,
    tableHtml: '',
    western: [],
    ganzhi,
    date: { year: 2026, month: 9, day: 29 },
    time: '20:58'
  });
  const expectedGanzhiKm = 'ចូរពន្យល់អត្ថន័យតាមហោរាសាស្ត្រចិន(干支) ដែលត្រូវនឹងថ្ងៃទី ២៩ ខែកញ្ញា ឆ្នាំ ២០២៦ ម៉ោង ២០ និង ៥៨ នាទី៖\n'
    + '- ឆ្នាំ៖ 丙午 មមី (ឆុង៖ ជូត)\n'
    + '- ខែ៖ 丁酉 រកា (ឆុង៖ ថោះ)\n'
    + '- ថ្ងៃ៖ 丙午 មមី (ឆុង៖ ជូត)\n'
    + '- ម៉ោង៖ 戊戌 ច (ឆុង៖ រោង)។';
  assert.equal(ganzhiKm, expectedGanzhiKm);

  const big3En = astrologySearchQuery({
    kind: 'big3',
    khmer: false,
    tableHtml: '',
    western,
    ganzhi: [],
    date: { year: 2026, month: 9, day: 29 },
    time: '20:58'
  });
  const expectedBig3En = 'Please explain the traditional astrological meanings of the Big 3 (Sun, Moon, and Rising) for September 29, 2026, at 20:58 (unspecified location):\n'
    + '- Sun: Libra;\n'
    + '- Moon: Taurus;\n'
    + '- Rising: Gemini.';
  assert.equal(big3En, expectedBig3En);

  const big3Km = astrologySearchQuery({
    kind: 'big3',
    khmer: true,
    tableHtml: '',
    western,
    ganzhi: [],
    date: { year: 2026, month: 9, day: 29 },
    time: '20:58'
  });
  const expectedBig3Km = 'ចូរពន្យល់ពីអត្ថន័យតាមក្បួនហោរាសាស្ត្រលោកខាងលិច នៃធាតុសំខាន់ទាំង ៣ (Big 3) សម្រាប់ថ្ងៃទី ២៩ ខែកញ្ញា ឆ្នាំ ២០២៦ ម៉ោង ២០:៥៨ (ទីតាំងមិនបានបញ្ជាក់)៖\n'
    + '- ព្រះអាទិត្យ (Sun)៖ Libra\n'
    + '- ព្រះចន្ទ (Moon)៖ Taurus\n'
    + '- រះ (Rising)៖ Gemini ។';
  assert.equal(big3Km, expectedBig3Km);
});

