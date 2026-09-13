import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
after(() => server.close());
const { trackModalViewport } = await server.ssrLoadModule('/src/ui/ModalViewport.ts');

function fixture(withVisualViewport = true) {
  const viewport = Object.assign(new EventTarget(), { width: 1024, height: 768, offsetTop: 0, offsetLeft: 0 });
  const callbacks = new Map();
  let nextFrame = 0;
  const host = Object.assign(new EventTarget(), {
    visualViewport: withVisualViewport ? viewport : null,
    innerWidth: 1024, innerHeight: 768,
    requestAnimationFrame(callback) { callbacks.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { callbacks.delete(id); }
  });
  const styles = new Map();
  const classes = new Set();
  const overlay = {
    style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) },
    classList: { toggle: (key, enabled) => enabled ? classes.add(key) : classes.delete(key), remove: key => classes.delete(key) }
  };
  const flush = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback()); };
  return { host, viewport, overlay, styles, classes, callbacks, flush };
}

test('modal follows keyboard resize and Safari pan while the layout viewport stays unchanged', () => {
  const f = fixture();
  const cleanup = trackModalViewport(f.overlay, f.host);
  assert.equal(f.styles.get('--modal-height'), '768px');
  f.viewport.height = 318;
  f.viewport.dispatchEvent(new Event('resize'));
  f.viewport.offsetTop = 72;
  f.viewport.offsetLeft = 8;
  f.viewport.dispatchEvent(new Event('scroll'));
  assert.equal(f.callbacks.size, 1, 'coalesce viewport animation events');
  f.flush();
  assert.equal(f.host.innerHeight, 768, 'keyboard must not have to resize the page');
  assert.equal(f.styles.get('--modal-height'), '318px');
  assert.equal(f.styles.get('--modal-top'), '72px');
  assert.equal(f.styles.get('--modal-left'), '8px');
  assert.ok(f.classes.has('modal-compact'));

  Object.assign(f.viewport, { width: 768, height: 1024, offsetTop: 0, offsetLeft: 0 });
  f.viewport.dispatchEvent(new Event('resize'));
  f.flush();
  assert.equal(f.styles.get('--modal-width'), '768px');
  assert.equal(f.styles.get('--modal-height'), '1024px');
  assert.equal(f.styles.get('--modal-top'), '0px');
  assert.equal(f.classes.has('modal-compact'), false);
  cleanup();
});

test('closing a modal removes listeners and cancels pending viewport updates', () => {
  const f = fixture();
  const cleanup = trackModalViewport(f.overlay, f.host);
  f.viewport.dispatchEvent(new Event('resize'));
  cleanup();
  assert.equal(f.callbacks.size, 0);
  f.viewport.dispatchEvent(new Event('scroll'));
  f.host.dispatchEvent(new Event('resize'));
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.styles.size, 0);
  assert.equal(f.classes.size, 0);
});

test('browsers without VisualViewport fall back to the resized window', () => {
  const f = fixture(false);
  const cleanup = trackModalViewport(f.overlay, f.host);
  f.host.innerHeight = 300;
  f.host.dispatchEvent(new Event('resize'));
  f.flush();
  assert.equal(f.styles.get('--modal-height'), '300px');
  assert.equal(f.styles.get('--modal-top'), '0px');
  cleanup();
});
