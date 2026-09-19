import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { appManifestFile, defaultFontScale, isApple, isPhone, prefersNativeScrollbars, prefersNativeTimePicker } = await server.ssrLoadModule('/src/ui/Platform.ts');

test('installation icons match Android, Apple and Windows/Linux in both languages', async () => {
  const androidClients = [
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Safari/537.36' },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', userAgentData: { platform: 'Android', mobile: false } }
  ];
  const whiteIconClients = [
    { platform: 'iPhone' },
    { platform: 'MacIntel', maxTouchPoints: 5 },
    { userAgentData: { platform: 'macOS' } },
    { userAgentData: { platform: 'Chrome OS' }, platform: 'Linux x86_64' },
    {}
  ];
  const desktopIconClients = [
    { userAgentData: { platform: 'Windows' }, maxTouchPoints: 10 },
    { platform: 'Win32' },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    { platform: 'Linux x86_64' },
    { userAgentData: { platform: 'Linux' } },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }
  ];
  for (const language of ['en', 'km']) {
    for (const [clients, variant, icons] of [
      [androidClients, '', ['icons/app-logo.png', 'icons/apple-touch-icon.png']],
      [whiteIconClients, '.white', ['icons/app-icon-white-192.png', 'icons/app-icon-white-512.png']],
      [desktopIconClients, '.desktop', ['icons/app-icon-desktop-512.png']]
    ]) {
      for (const client of clients) {
        const file = appManifestFile(language, client);
        assert.equal(file, `manifest${variant}${language === 'km' ? '.km' : ''}.webmanifest`);
        const manifest = JSON.parse(await readFile(new URL(`../public/${file}`, import.meta.url), 'utf8'));
        assert.equal(manifest.lang, language);
        assert.deepEqual(manifest.icons.map(icon => icon.src), icons);
      }
    }
  }
});

test('phone font-size choices stay limited on iPhone and Android phone browsers', () => {
  for (const client of [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' },
    { userAgentData: { platform: 'Android', mobile: true } }
  ]) {
    assert.equal(isPhone(client), true);
    assert.equal(defaultFontScale(client), 1.0);
  }
});

test('tablet and desktop font sizes extend to 150%, including iPad desktop mode', () => {
  for (const client of [
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile Safari/604.1', platform: 'iPad' },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' },
    { userAgentData: { platform: 'Android', mobile: false }, maxTouchPoints: 5 },
    { userAgentData: { platform: 'Windows', mobile: false }, maxTouchPoints: 10 },
    { platform: 'MacIntel', maxTouchPoints: 0 },
    { platform: 'Linux x86_64' }
  ]) {
    assert.equal(isPhone(client), false);
    assert.equal(defaultFontScale(client), 1.2);
  }
});

test('Apple devices keep native scrollbar behavior, including desktop-mode iPadOS', () => {
  for (const client of [
    { platform: 'iPhone' },
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' },
    { userAgentData: { platform: 'iOS' } },
    { platform: 'MacIntel', maxTouchPoints: 5 },
    { platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgentData: { platform: 'macOS' } }
  ]) assert.equal(isApple(client), true);
  for (const client of [
    { userAgentData: { platform: 'Windows' }, maxTouchPoints: 10 },
    { platform: 'Win32' },
    { userAgentData: { platform: 'Android' } },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' },
    { userAgentData: { platform: 'Chrome OS' } },
    { platform: 'Linux x86_64' },
    {}
  ]) assert.equal(isApple(client), false);
});

test('iPhone and iPad retain native time pickers, including desktop-mode iPadOS', () => {
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' }), true);
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', platform: 'iPad' }), true);
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
});

test('Android and Apple retain overlay scrollbars while desktop platforms use auto-hide styling', () => {
  for (const client of [
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', maxTouchPoints: 5 },
    // Android desktop mode can remove Android from the legacy user agent.
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', userAgentData: { platform: 'Android', mobile: false } },
    { platform: 'iPhone' },
    { platform: 'MacIntel', maxTouchPoints: 5 },
    { userAgentData: { platform: 'macOS' } }
  ]) assert.equal(prefersNativeScrollbars(client), true);
  for (const client of [
    { platform: 'Win32', maxTouchPoints: 10 },
    { userAgentData: { platform: 'Windows' } },
    { platform: 'Linux x86_64' },
    { userAgentData: { platform: 'Chrome OS' } }
  ]) assert.equal(prefersNativeScrollbars(client), false);
});

test('Android phones and tablets use themed 24-hour controls regardless of native clock format', () => {
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' }), false);
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', maxTouchPoints: 5 }), false);
  assert.equal(prefersNativeTimePicker({ userAgentData: { platform: 'Android' } }), false);
});

test('desktop browsers use themed 24-hour controls even on touch-enabled Windows', () => {
  for (const client of [
    { userAgentData: { platform: 'Windows' }, maxTouchPoints: 10 },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' },
    { platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgentData: { platform: 'macOS' }, maxTouchPoints: 0 },
    { platform: 'Linux x86_64' },
    { userAgentData: { platform: 'Chrome OS' } },
    {}
  ]) assert.equal(prefersNativeTimePicker(client), false);
});
