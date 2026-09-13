import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const origin = 'https://calendar.test';
const source = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
const builtHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const manifestPath = builtHtml.match(/rel="manifest" href="([^"]+)"/)[1];
const basePath = new URL('.', new URL(manifestPath, origin)).pathname;
const appUrl = `${origin}${basePath}`;
const oldCache = `khmer-cal:${appUrl}:old-version`;
const siblingCache = `khmer-cal:${origin}/another-project/:old-version`;

function worker() {
  const listeners = {};
  const stores = new Map([['another-app-cache', new Map()], [oldCache, new Map()], [siblingCache, new Map()]]);
  const state = { offline: false, fail: undefined, claimed: false, notification: undefined, opened: undefined, clientList: [] };
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const fetch = async request => {
    const url = new URL(key(request));
    if (state.offline || url.pathname === state.fail) throw new Error('Offline');
    assert.ok(url.href.startsWith(appUrl), `Asset escaped the app path: ${url.href}`);
    const bytes = await readFile(new URL(`../dist/${url.pathname.slice(basePath.length)}`, import.meta.url));
    // Vite preview varies CORS responses even though these static bytes are identical.
    return new Response(bytes, { headers: { Vary: 'Origin' } });
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        addAll: async paths => {
          const responses = await Promise.all(paths.map(fetch));
          paths.forEach((path, index) => entries.set(key(path), responses[index]));
        },
        match: async (request, options = {}) => {
          const response = entries.get(key(request));
          // addAll's URL-only requests have no stored Origin header.
          if (response?.headers.has('Vary') && !options.ignoreVary && request.headers?.has('Origin')) return undefined;
          return response?.clone();
        }
      };
    }
  };
  const clients = {
    claim: async () => { state.claimed = true; },
    matchAll: async () => state.clientList,
    openWindow: async url => { state.opened = url; }
  };
  runInNewContext(source, {
    URL, caches, fetch, clients,
    self: {
      location: { origin }, clients,
      registration: { scope: appUrl, showNotification: async (title, options) => { state.notification = { title, options }; } },
      addEventListener: (name, handler) => { listeners[name] = handler; }
    }
  });
  const lifecycle = async (name, event = {}) => { let pending; listeners[name]({ ...event, waitUntil: promise => { pending = promise; } }); await pending; };
  const request = (path, mode = 'same-origin', method = 'GET', headers = {}) => {
    let response;
    listeners.fetch({ request: { url: new URL(path, origin).href, mode, method, headers: new Headers(headers) }, respondWith: promise => { response = promise; } });
    return response;
  };
  return { state, stores, lifecycle, request };
}

test('a single installation precaches the shell, code, styles, fonts and unseen artwork', async () => {
  const app = worker();
  await app.lifecycle('install');
  await app.lifecycle('activate');
  assert.ok(app.state.claimed);
  assert.ok(app.stores.has('another-app-cache'));
  assert.ok(app.stores.has(siblingCache));
  assert.ok(!app.stores.has(oldCache));
  app.state.offline = true;
  const html = await (await app.request(`${basePath}?from=homescreen`, 'navigate')).text();
  assert.equal(html, builtHtml);
  const assets = [...html.matchAll(/(?:src|href)="([^" ]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith('.js')));
  assert.ok(assets.some(asset => asset.endsWith('.css')));
  for (const asset of assets) {
    assert.ok((await app.request(asset)).ok, asset);
  }
  const css = await (await app.request(assets.find(asset => asset.endsWith('.css')))).text();
  const fonts = [...css.matchAll(/url\(["']?([^)'" ]+\.ttf)["']?\)/g)].map(match => match[1]);
  assert.equal(fonts.length, 4);
  for (const font of fonts) assert.ok((await app.request(font)).ok, font);
  assert.ok((await app.request(`${basePath}assets/drawables/zodiac_tiger_400.png`)).ok);
  await assert.rejects(app.request(`${basePath}assets/missing.js`), /Offline/);
  assert.equal(app.request('https://other.test/data'), undefined);
  assert.equal(app.request(`${basePath}api/subscribe`, 'same-origin', 'POST'), undefined);
  if (basePath !== '/') {
    assert.equal(app.request('/another-project/', 'navigate'), undefined);
    assert.equal(app.request(`${basePath.slice(0, -1)}-other/`, 'navigate'), undefined);
  }
});

test('a failed install does not claim clients or remove the working version', async () => {
  const app = worker();
  app.state.fail = `${basePath}index.html`;
  await assert.rejects(app.lifecycle('install'), /Offline/);
  assert.equal(app.state.claimed, false);
  assert.ok(app.stores.has(oldCache));
});

test('offline module requests still match when browser CORS headers differ from precaching', async () => {
  const app = worker();
  await app.lifecycle('install');
  app.state.offline = true;
  const script = builtHtml.match(/<script[^>]+src="([^"]+)"/)[1];
  const response = await app.request(script, 'cors', 'GET', { Origin: origin });
  assert.ok(response.ok);
  assert.ok((await response.text()).includes('serviceWorker'));
});

test('Home Screen metadata resolves inside the deployed app and its icons are available offline', async () => {
  const app = worker();
  await app.lifecycle('install');
  app.state.offline = true;
  // Both language choices must install the same app and remain usable offline.
  for (const file of ['manifest.webmanifest', 'manifest.km.webmanifest']) {
    const manifestUrl = new URL(file, appUrl);
    const manifest = await (await app.request(manifestUrl.href)).json();
    for (const field of ['start_url', 'scope', 'id']) {
      assert.equal(new URL(manifest[field], manifestUrl).href, appUrl, field);
    }
    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl);
      assert.ok(iconUrl.href.startsWith(appUrl));
      assert.ok((await app.request(iconUrl.href)).ok);
    }
  }
});

test('notifications use this installation for icons and opening the app', async () => {
  const app = worker();
  await app.lifecycle('push');
  const { options } = app.state.notification;
  assert.equal(options.icon, `${appUrl}icons/app-logo.png`);
  assert.equal(options.badge, `${appUrl}icons/apple-touch-icon.png`);
  assert.equal(options.data, appUrl);
  app.state.clientList = [{ url: `${appUrl}another-project/`, focus: () => assert.fail('Focused another project') }];
  await app.lifecycle('notificationclick', { notification: { data: options.data, close() {} } });
  assert.equal(app.state.opened, appUrl);
});

test('push and existing notification clicks cannot leave the app scope', async () => {
  const unsafeTargets = [
    'https://other.test/phishing', '//other.test/phishing',
    'javascript:alert(1)', 'data:text/html,hello', 'https://[invalid',
    `${origin.replace('://', '://user:password@')}${basePath}`,
    null, 42, { url: appUrl }
  ];
  if (basePath !== '/') unsafeTargets.push('/another-project/', '../another-project/', `${basePath.slice(0, -1)}-other/`);
  for (const target of unsafeTargets) {
    const app = worker();
    await app.lifecycle('push', { data: { json: () => ({ url: target }) } });
    assert.equal(app.state.notification.options.data, appUrl);
    // Also cover notifications created by an older worker or the local prototype.
    await app.lifecycle('notificationclick', { notification: { data: target, close() {} } });
    assert.equal(app.state.opened, appUrl);
  }
});

test('valid notification links focus an existing app window and null payloads are tolerated', async () => {
  const app = worker();
  const target = `${appUrl}?event=123`;
  await app.lifecycle('push', { data: { json: () => ({ url: '?event=123' }) } });
  assert.equal(app.state.notification.options.data, target);
  let focused = false;
  app.state.clientList = [{ url: target, focus: () => { focused = true; } }];
  await app.lifecycle('notificationclick', { notification: { data: target, close() {} } });
  assert.equal(focused, true);
  assert.equal(app.state.opened, undefined);
  await app.lifecycle('push', { data: { json: () => null } });
  assert.equal(app.state.notification.options.data, appUrl);
});
