import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { startTodayRefresh } = await server.ssrLoadModule('/src/ui/TodayRefresh.ts');

function fixture(hidden = false) {
  const timers = new Map(), microtasks = [], changes = [];
  let id = 0, blocked = false, current = { date: '2026-09-16', zoneKey: 'local:Europe/Brussels:-120' };
  const host = Object.assign(new EventTarget(), {
    setInterval(callback, delay) { assert.equal(delay, 30000); timers.set(++id, callback); return id; },
    clearInterval(id) { timers.delete(id); }, queueMicrotask(callback) { microtasks.push(callback); }
  });
  const visibility = Object.assign(new EventTarget(), { hidden });
  const controller = startTodayRefresh(() => current, (next, previous) => changes.push({ next, previous }), () => blocked, host, visibility);
  return { timers, changes, host, visibility, controller,
    state(next) { current = { ...current, ...next }; }, block(value) { blocked = value; },
    tick() { [...timers.values()].forEach(callback => callback()); },
    flush() { microtasks.splice(0).forEach(callback => callback()); },
    visible(value) { visibility.hidden = !value; visibility.dispatchEvent(new Event('visibilitychange')); }
  };
}

test('foreground midnight refresh pauses while hidden and returns immediately with one timer', () => {
  const f = fixture();
  assert.equal(f.timers.size, 1);
  f.tick(); assert.equal(f.changes.length, 0);
  f.state({ date: '2026-09-17' }); f.tick();
  assert.equal(f.changes[0].previous.date, '2026-09-16');
  f.visible(false); assert.equal(f.timers.size, 0);
  f.state({ date: '2026-09-19' }); f.tick(); assert.equal(f.changes.length, 1);
  f.visible(true); assert.equal(f.changes[1].next.date, '2026-09-19');
  f.visible(true); f.host.dispatchEvent(new Event('pageshow'));
  assert.equal(f.timers.size, 1); assert.equal(f.changes.length, 2);
  f.controller.dispose(); assert.equal(f.timers.size, 0);
});

test('hidden startup and page cache restore stop and resume without duplicate listeners', () => {
  const f = fixture(true);
  assert.equal(f.timers.size, 0);
  f.visible(true); assert.equal(f.timers.size, 1);
  f.host.dispatchEvent(new Event('pagehide')); assert.equal(f.timers.size, 0);
  f.state({ date: '2026-09-18' }); f.host.dispatchEvent(new Event('focus'));
  assert.equal(f.changes.length, 0);
  f.host.dispatchEvent(new Event('pageshow')); assert.equal(f.changes.length, 1);
  f.controller.dispose(); f.visible(true); f.host.dispatchEvent(new Event('pageshow'));
  assert.equal(f.timers.size, 0);
});

test('clock reversal and timezone/DST changes refresh even when the civil date is unchanged', () => {
  const f = fixture();
  f.state({ zoneKey: 'local:Europe/Brussels:-60' }); f.tick();
  assert.equal(f.changes.length, 1);
  f.state({ zoneKey: 'local:Europe/Paris:-60' }); f.host.dispatchEvent(new Event('focus'));
  assert.equal(f.changes.length, 2);
  f.state({ date: '2026-09-15' }); f.tick();
  assert.equal(f.changes[2].next.date, '2026-09-15');
  f.controller.dispose();
});

test('modal drafts defer changes until the last modal closes, without waiting another tick', () => {
  const f = fixture(); f.block(true); f.state({ date: '2026-09-17' }); f.tick();
  assert.equal(f.changes.length, 0);
  f.visibility.dispatchEvent(new Event('calendar-modal-closed')); f.flush();
  assert.equal(f.changes.length, 0, 'another modal may open in the same gesture');
  f.block(false); f.visibility.dispatchEvent(new Event('calendar-modal-closed')); f.flush();
  assert.equal(f.changes.length, 1);
  assert.equal(f.changes[0].previous.date, '2026-09-16');
  f.state({ date: '2026-09-18' }); f.controller.reset(); f.tick();
  assert.equal(f.changes.length, 1, 'explicit Today follows changes reset the baseline');
  f.visibility.dispatchEvent(new Event('calendar-modal-closed')); f.controller.dispose(); f.flush();
  assert.equal(f.changes.length, 1);
});
