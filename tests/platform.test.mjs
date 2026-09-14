import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
after(() => server.close());
const { isWindows, prefersNativeTimePicker } = await server.ssrLoadModule('/src/ui/Platform.ts');

test('Windows scrollbar styling excludes iPad desktop mode and other platforms', () => {
  assert.equal(isWindows({ userAgentData: { platform: 'Windows' }, maxTouchPoints: 10 }), true);
  assert.equal(isWindows({ platform: 'Win32' }), true);
  assert.equal(isWindows({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), true);
  for (const client of [
    { platform: 'MacIntel', maxTouchPoints: 5 },
    { platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgentData: { platform: 'Android' } },
    { platform: 'Linux x86_64' },
    {}
  ]) assert.equal(isWindows(client), false);
});

test('iPhone and iPad retain native time pickers, including desktop-mode iPadOS', () => {
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' }), true);
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', platform: 'iPad' }), true);
  assert.equal(prefersNativeTimePicker({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
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
