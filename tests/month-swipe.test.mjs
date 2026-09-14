import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
after(() => server.close());
const { adjacentMonth, bindMonthSwipe } = await server.ssrLoadModule('/src/ui/MonthSwipe.ts');

function fixture(width = 640) {
  const host = new EventTarget();
  const doc = Object.assign(new EventTarget(), { defaultView: host });
  const captures = new Set();
  const createCard = () => ({ getBoundingClientRect: () => ({ width }) });
  let card = createCard();
  const cell = { closest: () => card };
  const root = Object.assign(new EventTarget(), {
    ownerDocument: doc,
    contains: element => element === card,
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id)
  });
  const months = [];
  const cleanup = bindMonthSwipe(root, direction => {
    months.push(direction);
    card = createCard(); // Rendering replaces the month card, but keeps the app root.
  });
  function emit(type, props = {}) {
    const event = new Event(type, { cancelable: true });
    const values = {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1,
      clientX: 200, clientY: 100, target: cell, ...props
    };
    for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
    (type === 'click' || type === 'lostpointercapture' ? root : doc).dispatchEvent(event);
    if (type === 'pointerup' || type === 'pointercancel') captures.delete(values.pointerId);
    return event;
  }
  function drag(dx, dy = 0, props = {}) {
    emit('pointerdown', props);
    emit('pointermove', { ...props, clientX: 200 + dx, clientY: 100 + dy });
    emit('pointerup', { ...props, clientX: 200 + dx, clientY: 100 + dy, buttons: 0 });
  }
  return { root, host, emit, drag, months, captures, cleanup };
}

test('left/right swipes advance once per release and suppress clicks across renders', () => {
  const f = fixture();
  f.emit('pointerdown');
  f.emit('pointermove', { clientX: 90 });
  f.emit('pointermove', { clientX: 20 });
  assert.deepEqual(f.months, [], 'do not change month during the drag');
  assert.ok(f.captures.has(1), 'capture away from date buttons once swiping');
  f.emit('pointerup', { clientX: 20, buttons: 0 });
  assert.deepEqual(f.months, [1]);
  assert.ok(f.emit('click', { detail: 1 }).defaultPrevented);
  f.drag(140, 20);
  assert.deepEqual(f.months, [1, -1]);
  assert.ok(f.emit('click', { detail: 1 }).defaultPrevented);
  f.cleanup();
});

test('date taps and keyboard activation still work after a swipe', () => {
  const f = fixture();
  f.drag(-140);
  assert.equal(f.emit('click', { detail: 0 }).defaultPrevented, false);
  f.drag(3, 2);
  assert.equal(f.emit('click', { detail: 1 }).defaultPrevented, false);
  assert.deepEqual(f.months, [1]);
  f.cleanup();
});

test('short, vertical and undecided diagonal drags do not change the month or click a date', () => {
  const f = fixture();
  for (const [dx, dy] of [[60, 0], [10, 180], [100, 100], [140, 125]]) {
    f.drag(dx, dy);
    assert.ok(f.emit('click', { detail: 1 }).defaultPrevented);
  }
  f.emit('pointerdown');
  const vertical = f.emit('pointermove', { clientX: 201, clientY: 135 });
  assert.equal(vertical.defaultPrevented, false, 'leave vertical scrolling to the browser');
  assert.equal(f.captures.size, 0);
  f.emit('pointermove', { clientX: 40, clientY: 136 });
  f.emit('pointerup', { clientX: 40, clientY: 136 });
  assert.deepEqual(f.months, [], 'a vertical start cannot turn into a month swipe');
  f.cleanup();
});

test('portrait grids accept shorter swipes in both directions without opening dates', () => {
  const f = fixture(350);
  f.drag(-50, 15);
  assert.deepEqual(f.months, [1]);
  assert.ok(f.emit('click', { detail: 1 }).defaultPrevented);
  f.drag(50, 15);
  assert.deepEqual(f.months, [1, -1]);
  assert.ok(f.emit('click', { detail: 1 }).defaultPrevented);
  f.drag(20, 2);
  assert.deepEqual(f.months, [1, -1], 'small finger movements must not turn the page');
  f.cleanup();
});

test('a diagonal start can settle into a horizontal swipe without an early vertical lock', () => {
  const f = fixture(350);
  f.emit('pointerdown');
  f.emit('pointermove', { clientX: 214, clientY: 113 });
  assert.equal(f.captures.size, 0, 'wait until the direction is clear');
  f.emit('pointermove', { clientX: 240, clientY: 120 });
  assert.ok(f.captures.has(1));
  f.emit('pointerup', { clientX: 255, clientY: 125 });
  assert.deepEqual(f.months, [-1]);
  f.cleanup();
});

test('short swipes still work when movement events are sparse', () => {
  const f = fixture(350);
  f.emit('pointerdown');
  f.emit('pointermove', { clientX: 205, clientY: 102 });
  f.emit('pointerup', { clientX: 250, clientY: 110 });
  assert.deepEqual(f.months, [-1]);
  assert.ok(f.emit('click', { detail: 1 }).defaultPrevented);
  f.cleanup();
});

test('pinch, pointer cancellation, lost capture and window blur cancel navigation', () => {
  const f = fixture();
  for (const interrupt of [
    () => f.emit('pointerdown', { pointerId: 2, isPrimary: false, target: {} }),
    () => f.emit('pointercancel'),
    () => f.emit('lostpointercapture', { target: f.root }),
    () => f.host.dispatchEvent(new Event('blur'))
  ]) {
    f.emit('pointerdown');
    f.emit('pointermove', { clientX: 60 });
    interrupt();
    f.emit('pointerup', { clientX: 40 });
    assert.equal(f.captures.size, 0);
  }
  assert.deepEqual(f.months, []);
  f.drag(-120);
  assert.deepEqual(f.months, [1], 'the next single-pointer swipe still works');
  f.cleanup();
});

test('ignore gestures outside the card and non-primary buttons or pointers', () => {
  const f = fixture();
  for (const props of [{ target: {} }, { button: 2 }, { isPrimary: false }]) f.drag(-140, 0, props);
  assert.deepEqual(f.months, []);
  f.cleanup();
});

test('cleanup releases capture and removes navigation/click handlers', () => {
  const f = fixture();
  f.emit('pointerdown');
  f.emit('pointermove', { clientX: 40 });
  f.cleanup();
  f.emit('pointerup', { clientX: 40 });
  f.drag(-140);
  assert.deepEqual(f.months, []);
  assert.equal(f.captures.size, 0);
  assert.equal(f.emit('click', { detail: 1 }).defaultPrevented, false);
});

test('month navigation crosses years and stops at both supported date limits', () => {
  assert.deepEqual(adjacentMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(adjacentMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.equal(adjacentMonth(1800, 1, -1), null);
  assert.equal(adjacentMonth(2200, 12, 1), null);
  assert.deepEqual(adjacentMonth(1800, 1, 1), { year: 1800, month: 2 });
  assert.deepEqual(adjacentMonth(2200, 12, -1), { year: 2200, month: 11 });
});
