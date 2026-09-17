import assert from 'node:assert/strict';
import { test, after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] }
});
after(() => server.close());

const { L } = await server.ssrLoadModule('/src/data/i18n.ts');
const { showCalendarSources } = await server.ssrLoadModule('/src/ui/Sources.ts');

test('archive source and copy translations resolve in English and Khmer', () => {
  assert.equal(
    L.text('about.event_archive_source', false),
    'Events for 2000–2030 were captured from Khmer Lunar Calendar.'
  );
  assert.equal(
    L.text('about.event_archive_source', true),
    'ព្រឹត្តិការណ៍សម្រាប់ឆ្នាំ ២០០០–២០៣០ ត្រូវបានដកស្រង់ចេញពីប្រតិទិនចន្ទគតិខ្មែរ។'
  );
  assert.equal(L.text('ui.copy', false), 'Copy');
  assert.equal(L.text('ui.copy', true), 'ចម្លង');
  assert.equal(L.text('ui.url_copied', false), 'URL copied');
  assert.equal(L.text('ui.url_copied', true), 'បានចម្លងតំណភ្ជាប់');
});

function createMockDom() {
  class MockElement extends EventTarget {
    constructor(tagName = 'div') {
      super();
      this.tagName = tagName.toUpperCase();
      this.classList = {
        _set: new Set(),
        add: (...names) => names.forEach(n => this.classList._set.add(n)),
        remove: (...names) => names.forEach(n => this.classList._set.delete(n)),
        contains: name => this.classList._set.has(name),
        toggle: (name, force) => {
          const has = typeof force === 'boolean' ? force : !this.classList.contains(name);
          if (has) this.classList.add(name); else this.classList.remove(name);
          return has;
        }
      };
      this.attributes = new Map();
      this.children = [];
      this.parentNode = null;
      this._innerHTML = '';
      this.style = {
        _map: new Map(),
        setProperty: (k, v) => this.style._map.set(k, String(v)),
        removeProperty: k => this.style._map.delete(k),
        getPropertyValue: k => this.style._map.get(k) ?? ''
      };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() {}
    get textContent() {
      if (this._text !== undefined) return this._text;
      let text = '';
      for (const child of this.children) {
        const cText = child.textContent;
        if (cText) {
          text += (text ? ' ' : '') + cText;
        }
      }
      return text;
    }
    set textContent(val) {
      this.children = [];
      this._text = String(val);
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
      this._innerHTML = html;
      this._parse(html);
    }
    _parse(html) {
      this.children = [];
      let currentText = '';
      const tokenizer = /<(\/)?([a-z0-9-]+)([^>]*)>|([^<]+)/gi;
      let m;
      let current = this;
      const stack = [this];
      while ((m = tokenizer.exec(html)) !== null) {
        if (m[4]) {
          const text = m[4].trim();
          if (text) {
            current._text = (current._text ? current._text + ' ' : '') + text;
          }
          continue;
        }
        const isClosing = m[1] === '/';
        const tagName = m[2];
        const attrStr = m[3] || '';
        const isSelfClosing = attrStr.trim().endsWith('/') || ['img', 'br', 'hr', 'input'].includes(tagName.toLowerCase());

        if (isClosing) {
          if (stack.length > 1) {
            stack.pop();
            current = stack[stack.length - 1];
          }
          continue;
        }

        const child = new MockElement(tagName);
        child.parentNode = current;
        current.children.push(child);

        const attrRegex = /([a-z0-9-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
        let a;
        while ((a = attrRegex.exec(attrStr)) !== null) {
          const attrName = a[1];
          const attrVal = a[2] ?? a[3] ?? a[4] ?? '';
          if (attrName === 'class') {
            attrVal.split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
          } else {
            child.setAttribute(attrName, attrVal);
          }
        }

        if (!isSelfClosing) {
          stack.push(child);
          current = child;
        }
      }
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    querySelectorAll(selector) {
      const results = [];
      const match = el => {
        if (selector.startsWith('.')) {
          return el.classList.contains(selector.slice(1));
        }
        if (selector.startsWith('[') && selector.endsWith(']')) {
          const inner = selector.slice(1, -1);
          const eq = inner.indexOf('=');
          if (eq === -1) return el.attributes.has(inner);
          const name = inner.slice(0, eq);
          let val = inner.slice(eq + 1);
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          return el.getAttribute(name) === val;
        }
        return el.tagName.toLowerCase() === selector.toLowerCase();
      };
      const walk = node => {
        for (const child of node.children) {
          if (match(child)) results.push(child);
          walk(child);
        }
      };
      walk(this);
      return results;
    }
  }

  const body = new MockElement('body');
  const app = new MockElement('div');
  app.setAttribute('id', 'app');
  body.appendChild(app);

  let clipboardText = '';
  globalThis.HTMLElement = MockElement;
  globalThis.document = {
    createElement: tag => new MockElement(tag),
    body,
    activeElement: null,
    getElementById: id => (id === 'app' ? app : null),
    querySelector: sel => body.querySelector(sel),
    querySelectorAll: sel => body.querySelectorAll(sel),
    dispatchEvent: () => {}
  };
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: {
      writeText: async text => { clipboardText = String(text); }
    },
    configurable: true
  });
  globalThis.window = Object.assign(new EventTarget(), {
    requestAnimationFrame: cb => setTimeout(cb, 0),
    cancelAnimationFrame: () => {}
  });

  return {
    body,
    app,
    getClipboard: () => clipboardText,
    resetClipboard: () => { clipboardText = ''; }
  };
}

test('sources dialog renders archive credit and opens copyable URL dialog', async () => {
  const dom = createMockDom();

  // Open English Sources Dialog
  const closeSources = showCalendarSources(false);
  const sourcesDialog = dom.body.querySelector('.sources-dialog');
  assert.ok(sourcesDialog, 'sources dialog should be rendered');

  // Archive credit paragraph
  const archiveLink = dom.body.querySelector('[data-url-source="archive"]');
  assert.ok(archiveLink, 'archive source link should exist');
  assert.equal(archiveLink.textContent, 'Khmer Lunar Calendar');

  // Click archive source link
  const clickEvent = new Event('click');
  clickEvent.preventDefault = () => {};
  archiveLink.dispatchEvent(clickEvent);

  // URL dialog should be open
  const urlDialog = dom.body.querySelector('.source-url-dialog');
  assert.ok(urlDialog, 'URL dialog should appear');
  assert.equal(dom.body.querySelector('.source-url-title')?.textContent, 'Khmer Lunar Calendar');
  assert.equal(dom.body.querySelector('.source-url-text')?.textContent, 'https://khmer-lunar-calendar.com/');

  // Copy button
  const copyBtn = dom.body.querySelector('.source-url-copy');
  assert.ok(copyBtn, 'Copy button should exist');
  assert.equal(copyBtn.textContent, 'Copy');

  copyBtn.dispatchEvent(new Event('click'));
  await new Promise(r => setTimeout(r, 10));
  assert.equal(dom.getClipboard(), 'https://khmer-lunar-calendar.com/');
  assert.equal(dom.body.querySelector('.source-url-dialog'), null, 'URL dialog should close after copying');

  // Close main sources dialog
  closeSources();
  assert.equal(dom.body.querySelector('.sources-dialog'), null, 'Sources dialog should be closed');
});

test('sources dialog works in Khmer and close button dismisses URL dialog', () => {
  const dom = createMockDom();

  // Open Khmer Sources Dialog
  const closeSources = showCalendarSources(true);
  const sourcesDialog = dom.body.querySelector('.sources-dialog');
  assert.ok(sourcesDialog, 'sources dialog should be rendered in Khmer');

  const archiveLink = dom.body.querySelector('[data-url-source="archive"]');
  assert.ok(archiveLink, 'Khmer archive link should exist');
  assert.equal(archiveLink.textContent, 'ប្រតិទិនចន្ទគតិខ្មែរ');

  // Click archive link
  const clickEvent = new Event('click');
  clickEvent.preventDefault = () => {};
  archiveLink.dispatchEvent(clickEvent);

  const urlDialog = dom.body.querySelector('.source-url-dialog');
  assert.ok(urlDialog, 'URL dialog should appear');
  assert.equal(dom.body.querySelector('.source-url-title')?.textContent, 'ប្រតិទិនចន្ទគតិខ្មែរ');
  assert.equal(dom.body.querySelector('.source-url-copy')?.textContent, 'ចម្លង');
  assert.equal(dom.body.querySelector('.source-url-close')?.textContent, 'បិទ');

  // Click close button
  const closeBtn = dom.body.querySelector('.source-url-close');
  closeBtn.dispatchEvent(new Event('click'));
  assert.equal(dom.body.querySelector('.source-url-dialog'), null, 'Close button should dismiss URL dialog');

  closeSources();
});
