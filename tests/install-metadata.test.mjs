import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
after(() => server.close());
const { applyInstallMetadata } = await server.ssrLoadModule('/src/ui/InstallMetadata.ts');

// Record URLs when links become discoverable, not just their final DOM state.
function documentFixture() {
  const links = [];
  const discoveries = [];
  const record = link => discoveries.push({ rel: link.rel, href: link.getAttribute('href') });
  const doc = {
    createElement(tag) {
      assert.equal(tag, 'link');
      const attributes = new Map();
      return {
        rel: '',
        getAttribute: name => attributes.get(name) ?? null,
        setAttribute(name, value) {
          attributes.set(name, value);
          if (name === 'href' && links.includes(this)) record(this);
        },
        remove() { links.splice(links.indexOf(this), 1); }
      };
    },
    querySelector(selector) {
      const rel = selector.match(/^link\[rel="([^"]+)"\]$/)?.[1];
      assert.ok(rel, selector);
      return links.find(link => link.rel === rel) ?? null;
    },
    head: { appendChild(link) { links.push(link); record(link); return link; } }
  };
  return { doc, links, discoveries };
}

test('initial HTML does not expose the white manifest or touch icon before platform selection', async () => {
  for (const file of ['../index.html', '../dist/index.html']) {
    const html = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<link\b[^>]*\brel=["'](?:manifest|apple-touch-icon)["']/i);
  }
});

test('first manifest discovery selects desktop icons for Chrome, Edge and Linux clients in either language/base path', async () => {
  for (const client of [
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149.0 Safari/537.36', platform: 'Win32' },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149.0 Safari/537.36 Edg/149.0', userAgentData: { platform: 'Windows' } },
    { platform: 'Linux x86_64' }
  ]) {
    for (const base of ['/', '/khmer-calendar-pwa/']) {
      for (const language of ['km', 'en']) {
        const f = documentFixture();
        applyInstallMetadata(language, base, client, f.doc);
        const file = `manifest.desktop${language === 'km' ? '.km' : ''}.webmanifest`;
        assert.deepEqual(f.discoveries, [{ rel: 'manifest', href: `${base}${file}` }]);
        const manifest = JSON.parse(await readFile(new URL(`../dist/${file}`, import.meta.url), 'utf8'));
        assert.deepEqual(manifest.icons.map(icon => icon.src), ['icons/app-icon-desktop-512.png']);
      }
    }
  }
});

test('Apple keeps its white touch/manifest icons and Android never discovers them', () => {
  for (const client of [{ platform: 'iPhone' }, { platform: 'MacIntel', maxTouchPoints: 5 }, { userAgentData: { platform: 'macOS' } }]) {
    const f = documentFixture();
    applyInstallMetadata('km', '/khmer-calendar-pwa/', client, f.doc);
    assert.deepEqual(f.discoveries, [
      { rel: 'apple-touch-icon', href: '/khmer-calendar-pwa/icons/apple-touch-icon-white.png' },
      { rel: 'manifest', href: '/khmer-calendar-pwa/manifest.white.km.webmanifest' }
    ]);
    assert.equal(f.links[0].getAttribute('sizes'), '180x180');
  }
  for (const client of [
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/149.0 Mobile Safari/537.36' },
    { platform: 'Linux x86_64', userAgentData: { platform: 'Android', mobile: false } }
  ]) {
    const f = documentFixture();
    applyInstallMetadata('en', '/', client, f.doc);
    assert.deepEqual(f.discoveries, [{ rel: 'manifest', href: '/manifest.webmanifest' }]);
  }
});

test('theme reapplication does not rediscover icons and language changes keep a single manifest', () => {
  const f = documentFixture();
  const client = { platform: 'Win32' };
  applyInstallMetadata('km', '/', client, f.doc);
  applyInstallMetadata('km', '/', client, f.doc);
  assert.equal(f.discoveries.length, 1);
  applyInstallMetadata('en', '/', client, f.doc);
  assert.equal(f.links.length, 1);
  assert.deepEqual(f.discoveries, [
    { rel: 'manifest', href: '/manifest.desktop.km.webmanifest' },
    { rel: 'manifest', href: '/manifest.desktop.webmanifest' }
  ]);
});
