import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { setupModal, showModal, hideModal } = await server.ssrLoadModule('/src/ui/Modal.ts');

function fixture() {
  class Target extends EventTarget {
    listeners = new Map();
    addEventListener(type, listener, options) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
      this.listeners.get(type)?.delete(listener);
      super.removeEventListener(type, listener, options);
    }
    get count() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
  }
  class Element extends Target {
    isConnected = true;
    children = [];
    attributes = new Map();
    classes = new Set();
    classList = { contains: key => this.classes.has(key), add: key => this.classes.add(key),
      remove: key => this.classes.delete(key), toggle: (key, enabled) => enabled ? this.classes.add(key) : this.classes.delete(key) };
    style = { setProperty() {}, removeProperty() {} };
    setAttribute(key, value) { this.attributes.set(key, value); }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    querySelectorAll() { return this.children; }
    getClientRects() { return [1]; }
    focus() { doc.activeElement = this; }
  }
  const app = new Element();
  const opener = new Element();
  const parent = new Element();
  const child = new Element();
  const trigger = new Element();
  parent.children.push(trigger);
  const overlays = [parent, child];
  const doc = Object.assign(new Target(), { activeElement: opener,
    getElementById: () => app, querySelector: () => opener,
    querySelectorAll: () => overlays.filter(el => el.classList.contains('open')) });
  const viewport = Object.assign(new Target(), { width: 800, height: 600, offsetTop: 0, offsetLeft: 0 });
  const host = Object.assign(new Target(), { visualViewport: viewport, innerWidth: 800, innerHeight: 600 });
  globalThis.HTMLElement = Element;
  globalThis.document = doc;
  globalThis.window = host;
  setupModal(parent, () => hideModal(parent));
  setupModal(child, () => hideModal(child));
  return { app, opener, parent, child, trigger, doc, host, viewport };
}

test('closing a nested popup restores focus to the parent and keeps the app inert', () => {
  const f = fixture();
  let closed = 0;
  f.doc.addEventListener('calendar-modal-closed', () => closed++);
  showModal(f.parent, 'Parent');
  f.trigger.focus();
  showModal(f.child, 'Child');
  hideModal(f.child);
  assert.equal(f.doc.activeElement, f.trigger);
  assert.equal(f.app.inert, true);
  assert.equal(closed, 0);
  const escape = new Event('keydown', { cancelable: true });
  Object.defineProperty(escape, 'key', { value: 'Escape' });
  f.parent.dispatchEvent(escape);
  assert.equal(f.doc.activeElement, f.opener);
  assert.equal(f.app.inert, false);
  assert.equal(closed, 1);
  assert.equal(f.host.count, 0);
  assert.equal(f.viewport.count, 0);
});

test('reopening an active popup does not retain itself as its return-focus target', () => {
  const f = fixture();
  showModal(f.parent, 'First');
  showModal(f.parent, 'Updated');
  assert.equal(f.host.count, 1);
  assert.equal(f.viewport.count, 2);
  hideModal(f.parent);
  assert.equal(f.doc.activeElement, f.opener);
  f.trigger.focus();
  hideModal(f.parent);
  assert.equal(f.doc.activeElement, f.trigger, 'duplicate close must not move focus');
});

test('a removed child trigger falls back to the still-open parent sheet', () => {
  const f = fixture();
  showModal(f.parent, 'Parent');
  f.trigger.focus();
  showModal(f.child, 'Child');
  f.trigger.isConnected = false;
  hideModal(f.child);
  assert.equal(f.doc.activeElement, f.parent);
  hideModal(f.parent);
});
