import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { ModalHistory } = await server.ssrLoadModule('/src/ui/ModalHistory.ts');

function fixture() {
  const host = new EventTarget();
  const base = { unrelated: 'preserved' };
  const entries = [{ external: true }, base];
  const pending = [], traversals = [], closed = [];
  let index = 1;
  host.history = {
    get state() { return entries[index]; },
    pushState(state, title, url) {
      assert.equal(url, undefined, 'popup navigation must leave the URL unchanged');
      entries.splice(++index, Infinity, structuredClone(state));
    },
    go(delta) { traversals.push(delta); pending.push(delta); }
  };
  function travel(delta) {
    index += delta;
    assert.ok(index >= 0 && index < entries.length, 'traversal must stay inside history');
    if (index === 0) return; // A cross-document Back exits normally.
    host.dispatchEvent(Object.assign(new Event('popstate'), { state: structuredClone(entries[index]) }));
  }
  async function settle() {
    await Promise.resolve();
    let steps = 0;
    while (pending.length) {
      assert.ok(++steps < 10, 'history reconciliation must terminate');
      travel(pending.shift());
      await Promise.resolve();
    }
  }
  const controller = new ModalHistory(host);
  const popup = name => {
    const key = {};
    const close = () => { closed.push(name); controller.hide(key); };
    return { open: () => controller.show(key, close), close, key };
  };
  return { host, base, entries, pending, traversals, closed, controller, popup, travel, settle, get index() { return index; } };
}

test('Back dismisses three nested popup layers in order, then leaves normally', async () => {
  const f = fixture();
  for (const name of ['Date details', 'Event details', 'Learn more']) f.popup(name).open();
  for (const name of ['Learn more', 'Event details', 'Date details']) {
    f.travel(-1);
    await f.settle();
    assert.equal(f.closed.at(-1), name);
    assert.equal(f.pending.length, 0);
  }
  assert.equal(f.index, 1);
  assert.deepEqual(f.traversals, [], 'browser Back must not trigger a second Back');
  assert.deepEqual(f.host.history.state, f.base);
  f.travel(-1);
  assert.equal(f.index, 0, 'no permanent root guard may trap navigation');
});

test('Close/Save retire history without running dismissal a second time', async () => {
  const f = fixture(), parent = f.popup('Parent'), child = f.popup('Child');
  parent.open(); child.open(); child.close();
  await f.settle();
  assert.equal(f.index, 2);
  assert.deepEqual(f.closed, ['Child']);
  f.travel(-1);
  await f.settle();
  assert.deepEqual(f.closed, ['Child', 'Parent']);
  assert.equal(f.index, 1);
});

test('disposing a parent and its children batches their history cleanup', async () => {
  const f = fixture(), layers = ['Parent', 'Child', 'Grandchild'].map(f.popup);
  layers.forEach(popup => popup.open());
  layers.toReversed().forEach(popup => popup.close());
  await f.settle();
  assert.deepEqual(f.traversals, [-3]);
  assert.equal(f.index, 1);
});

test('updating an open popup and redundant closes do not add Back steps', async () => {
  const f = fixture(), popup = f.popup('Popup');
  popup.open(); popup.open(); popup.open();
  assert.equal(f.index, 2);
  popup.close(); popup.close();
  await f.settle();
  assert.deepEqual(f.traversals, [-1]);
  popup.open();
  assert.equal(f.entries.length, 3, 'reopening must discard the retired forward entry');
});

test('close-then-open replacement keeps a single Back step', async () => {
  const f = fixture(), details = f.popup('Details'), editor = f.popup('Editor');
  details.open(); details.close(); editor.open();
  await f.settle();
  assert.deepEqual(f.traversals, []);
  assert.equal(f.index, 2);
  f.travel(-1);
  await f.settle();
  assert.deepEqual(f.closed, ['Details', 'Editor']);
  assert.equal(f.index, 1);
});

test('opening a replacement while history cleanup is pending keeps it open', async () => {
  const f = fixture(), details = f.popup('Details'), editor = f.popup('Editor');
  details.open(); details.close();
  await Promise.resolve();
  assert.deepEqual(f.pending, [-1]);
  editor.open();
  await f.settle();
  assert.deepEqual(f.closed, ['Details']);
  assert.equal(f.index, 2);
  f.travel(-1);
  await f.settle();
  assert.deepEqual(f.closed, ['Details', 'Editor']);
});

test('replacing multiple layers and closing more during pending cleanup is safe', async () => {
  const f = fixture(), parent = f.popup('Parent'), child = f.popup('Child'), editor = f.popup('Editor');
  parent.open(); child.open(); child.close();
  await Promise.resolve();
  parent.close(); editor.open(); editor.close();
  await f.settle();
  assert.equal(f.index, 1);
  assert.deepEqual(f.closed, ['Child', 'Parent', 'Editor']);
});

test('Forward never resurrects a dismissed editor or adds empty Back steps', async () => {
  const f = fixture(), editor = f.popup('Editor'), child = f.popup('Date picker');
  editor.open(); child.open();
  f.travel(-1); await f.settle();
  f.travel(1); await f.settle();
  assert.equal(f.index, 2);
  assert.deepEqual(f.closed, ['Date picker']);
  f.travel(-1); await f.settle();
  f.travel(2); await f.settle();
  assert.equal(f.index, 1);
  assert.deepEqual(f.closed, ['Date picker', 'Editor']);
});

test('reload retires old modal entries and lets a freshly opened popup survive', async () => {
  const f = fixture();
  f.popup('Parent').open(); f.popup('Child').open();
  f.controller.dispose();
  const reloaded = new ModalHistory(f.host);
  const key = {};
  let closed = 0;
  reloaded.show(key, () => { closed++; reloaded.hide(key); });
  await f.settle();
  assert.equal(f.index, 2);
  assert.equal(closed, 0);
  f.travel(-1); await f.settle();
  assert.equal(closed, 1);
  assert.equal(f.index, 1);
});

test('a browser jump across multiple layers dismisses all skipped popups', async () => {
  const f = fixture();
  f.popup('Parent').open(); f.popup('Child').open(); f.popup('Grandchild').open();
  f.travel(-3);
  await f.settle();
  assert.deepEqual(f.closed, ['Grandchild', 'Child', 'Parent']);
  assert.equal(f.index, 1);
  assert.deepEqual(f.traversals, []);
});
