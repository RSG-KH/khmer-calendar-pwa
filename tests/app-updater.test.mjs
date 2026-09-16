import assert from 'node:assert/strict';
import { test, after, beforeEach } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { AppUpdater } = await server.ssrLoadModule('/src/ui/AppUpdater.ts');
beforeEach(t => t.mock.timers.enable({ apis: ['setTimeout'] }));

function fixture({ controlled = true, waiting = false, justUpdated = false } = {}) {
  const active = { state: 'activated' };
  const next = Object.assign(new EventTarget(), {
    state: waiting ? 'installed' : 'installing',
    messages: [],
    postMessage(message) { this.messages.push(message); }
  });
  const registration = Object.assign(new EventTarget(), {
    active, waiting: waiting ? next : null, installing: null,
    checks: 0, update: async () => { registration.checks++; }
  });
  const requests = [];
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? active : null,
    register: async (...args) => { requests.push(args); return registration; }
  });
  let online = true;
  let reloads = 0;
  const updater = new AppUpdater(container, '/khmer-calendar-pwa/sw.js', () => reloads++, () => online, justUpdated);
  const install = () => {
    registration.installing = next;
    registration.dispatchEvent(new Event('updatefound'));
  };
  const installed = () => {
    registration.installing = null;
    registration.waiting = next;
    next.state = 'installed';
    next.dispatchEvent(new Event('statechange'));
  };
  const activate = () => {
    registration.waiting = null;
    registration.active = next;
    next.state = 'activated';
    next.dispatchEvent(new Event('statechange'));
    container.controller = next;
    container.dispatchEvent(new Event('controllerchange'));
  };
  return { updater, container, registration, next, requests, install, installed, activate,
    offline: () => { online = false; }, get reloads() { return reloads; } };
}

test('checks without HTTP caching and resets the no-update result after three seconds', async t => {
  const f = fixture();
  await f.updater.check();
  assert.deepEqual(f.requests, [['/khmer-calendar-pwa/sw.js', { updateViaCache: 'none' }]]);
  assert.equal(f.registration.checks, 1);
  assert.equal(f.updater.state, 'current');
  assert.equal(f.reloads, 0);
  t.mock.timers.tick(2_999);
  assert.equal(f.updater.state, 'current');
  t.mock.timers.tick(1);
  assert.equal(f.updater.state, 'idle');
});

test('one check downloads completely, activates automatically and reloads exactly once', async () => {
  const f = fixture();
  f.registration.update = async () => { f.registration.checks++; f.install(); };
  await f.updater.check();
  assert.equal(f.updater.state, 'downloading');
  await f.updater.check();
  assert.equal(f.updater.state, 'downloading', 'a repeated check must keep showing the existing download');
  assert.equal(f.next.messages.length, 0);
  assert.equal(f.registration.checks, 1);
  f.installed();
  await f.updater.check();
  assert.deepEqual(f.next.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(f.updater.state, 'updating');
  assert.equal(f.reloads, 0, 'wait for the new worker to control the page');
  f.activate();
  f.container.dispatchEvent(new Event('controllerchange'));
  assert.equal(f.reloads, 1);
});

test('discovers an already waiting update and preserves it when the network check fails', async () => {
  const f = fixture({ waiting: true });
  f.registration.update = async () => { throw new Error('Network unavailable'); };
  await f.updater.check();
  assert.equal(f.updater.state, 'updating');
  f.activate();
  assert.equal(f.reloads, 1);
});

test('first installation claims the page without forcing a reload', async () => {
  const f = fixture({ controlled: false });
  f.registration.update = async () => f.install();
  await f.updater.check();
  f.activate();
  assert.equal(f.reloads, 0);
  assert.equal(f.updater.state, 'current');
});

test('one check on a first visit applies an update waiting on another open window', async () => {
  const f = fixture({ controlled: false, waiting: true });
  await f.updater.check();
  f.activate();
  assert.equal(f.reloads, 1);
});

test('an update activated in another window does not interrupt this window', async () => {
  const f = fixture();
  await f.updater.check();
  f.activate();
  assert.equal(f.reloads, 0);
  await f.updater.check();
  assert.equal(f.reloads, 1);
});

test('offline and failed checks report a recoverable state without reloading', async () => {
  const f = fixture();
  f.container.register = async () => { throw new Error('Registration failed'); };
  await f.updater.check();
  assert.equal(f.updater.state, 'error');
  f.container.register = async () => f.registration;
  await f.updater.check();
  assert.equal(f.updater.state, 'current');
  f.offline();
  await f.updater.check();
  assert.equal(f.updater.state, 'offline');
  assert.equal(f.reloads, 0);
});

test('a failed asset download cannot be offered as a ready update', async () => {
  const f = fixture();
  f.registration.update = async () => f.install();
  await f.updater.check();
  f.registration.installing = null;
  f.next.state = 'redundant';
  f.next.dispatchEvent(new Event('statechange'));
  assert.equal(f.updater.state, 'error');
  assert.equal(f.reloads, 0);
  assert.equal(f.next.messages.length, 0);
});

test('unsupported previews and browsers do not register workers or reload', async () => {
  const updater = new AppUpdater(undefined, '/sw.js', () => assert.fail('Unexpected reload'));
  updater.start();
  await updater.check();
  assert.equal(updater.state, 'unavailable');
});

test('settings subscriptions are released when the screen is replaced', async () => {
  const f = fixture();
  const states = [];
  const unsubscribe = f.updater.subscribe(state => states.push(state));
  await f.updater.check();
  assert.deepEqual(states, ['idle', 'checking', 'current']);
  unsubscribe();
  f.install();
  assert.equal(states.length, 3);
});

test('a completed update receipt shows Updated for three seconds without another reload', async t => {
  const f = fixture({ justUpdated: true });
  assert.equal(f.updater.state, 'updated');
  f.updater.start();
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(2_999);
  assert.equal(f.updater.state, 'updated');
  t.mock.timers.tick(1);
  assert.equal(f.updater.state, 'idle');
  assert.equal(f.reloads, 0);
});

test('background downloads wait for a user check and a cached update can apply offline', async () => {
  const f = fixture();
  f.updater.start();
  await new Promise(resolve => setImmediate(resolve));
  f.install();
  f.installed();
  assert.equal(f.updater.state, 'idle');
  assert.equal(f.next.messages.length, 0);
  f.offline();
  await f.updater.check();
  assert.equal(f.updater.state, 'updating');
  f.activate();
  assert.equal(f.reloads, 1);
});

test('activation timeout allows retry instead of leaving the button stuck', async t => {
  const f = fixture({ waiting: true });
  await f.updater.check();
  t.mock.timers.tick(15_000);
  assert.equal(f.updater.state, 'error');
  assert.equal(f.reloads, 0);
  await f.updater.check();
  assert.equal(f.updater.state, 'updating');
  f.activate();
  assert.equal(f.reloads, 1);
});

test('failure to send the activation request reports an error without claiming success', async () => {
  const f = fixture({ waiting: true });
  f.next.postMessage = () => { throw new Error('Worker unavailable'); };
  await f.updater.check();
  assert.equal(f.updater.state, 'error');
  assert.equal(f.reloads, 0);
});
