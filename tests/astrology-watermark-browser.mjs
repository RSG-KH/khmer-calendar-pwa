// Run: node tests/astrology-watermark-browser.mjs
// Starts Vite and an isolated Chromium profile; never uses saved browser data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const browserPath = [process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
assert.ok(browserPath, 'Set BROWSER_PATH to a Chromium browser');
const server = await createServer({ server: { port: 0, host: '127.0.0.1', ws: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const profile = await mkdtemp(path.join(tmpdir(), 'astrology-watermark-'));
const browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
const exited = new Promise(resolve => browser.once('exit', resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map();
let socket, call;
try {
  let port;
  for (let attempt = 0; attempt < 150 && !port; attempt++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Browser debugging endpoint did not start');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) {
      pending.delete(message.id); clearTimeout(request.timer);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    }
  });
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 30_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  await call('Page.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const loaded = new Promise(resolve => socket.addEventListener('message', function onMessage(event) {
    if (JSON.parse(event.data).method === 'Page.loadEventFired') {
      socket.removeEventListener('message', onMessage); resolve();
    }
  }));
  await call('Page.navigate', { url });
  await loaded;
  const profiles = [
    { name: 'short-landscape', width: 640, height: 240 },
    { name: 'phone-landscape', width: 844, height: 390, phone: true },
    { name: 'phone-portrait', width: 320, height: 640, phone: true },
    { name: 'tablet-landscape', width: 1280, height: 800 },
    { name: 'tablet-portrait', width: 800, height: 1280 },
    { name: 'desktop', width: 1920, height: 1080 },
  ];
  let checks = 0;
  for (const viewport of profiles) {
    await call('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false,
    });
    for (const khmer of [false, true]) for (const font of [0.8, 1, 1.5]) for (const emoji of [false, true]) {
      for (const kind of ['ganzhi', 'big3']) {
        const options = { ...viewport, khmer, font, emoji, kind };
        const result = await evaluate(`(${inspect.toString()})(${JSON.stringify(options)})`);
        assert.deepEqual(result.errors, [], JSON.stringify(options));
        checks++;
        if (process.env.ASTROLOGY_SCREENSHOT_DIR && font === 1 && !emoji &&
          ['short-landscape', 'phone-portrait', 'tablet-landscape'].includes(viewport.name)) {
          const directory = path.resolve(process.env.ASTROLOGY_SCREENSHOT_DIR);
          await mkdir(directory, { recursive: true });
          const shot = await call('Page.captureScreenshot', { format: 'png' });
          await writeFile(path.join(directory, `${viewport.name}-${kind}-${khmer ? 'km' : 'en'}.png`), Buffer.from(shot.data, 'base64'));
        }
        await evaluate('window.watermarkTestParent.close()');
      }
    }
    // An unsupported solar year has no Year watermark, with the same content-sized footer.
    const result = await evaluate(`(${inspect.toString()})(${JSON.stringify({ ...viewport, khmer: false, font: 1, emoji: false, kind: 'ganzhi', year: 1850 })})`);
    assert.deepEqual(result.errors, [], `${viewport.name}: unsupported year`);
    await evaluate('window.watermarkTestParent.close()');
    console.log(`${viewport.name}: 24 watermark layouts and unsupported-year case passed`);
  }
  console.log(`PASS: ${checks} watermark layouts and ${profiles.length} unsupported-year cases`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await call('Browser.close').catch(() => {});
    socket.close();
  }
  browser.kill();
  await Promise.race([exited, delay(5_000)]);
  for (const request of pending.values()) clearTimeout(request.timer);
  await server.close();
  const resolvedProfile = await realpath(profile);
  const resolvedTemp = await realpath(tmpdir());
  assert.equal(path.dirname(resolvedProfile), resolvedTemp, 'Only remove this test profile in the temp directory');
  assert.ok(path.basename(resolvedProfile).startsWith('astrology-watermark-'));
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function inspect(options) {
  const { DateDetailsDialogModal } = await import(new URL('src/ui/Modals.ts', location.href).href);
  const { Storage, DEFAULT_SETTINGS } = await import(new URL('src/data/Storage.ts', location.href).href);
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const rect = element => element.getBoundingClientRect();
  const near = (a, b) => Math.abs(a - b) < 0.75;
  const root = document.documentElement;
  root.toggleAttribute('data-phone', Boolean(options.phone));
  root.dataset.theme = options.khmer ? 'dark' : 'light';
  root.style.setProperty('--font-scale', options.font);
  Storage.saveSettings({ ...DEFAULT_SETTINGS, language: options.khmer ? 'km' : 'en',
    useEmojiForWesternZodiac: options.emoji, useEmojiForGanzhiAnimals: options.emoji });
  const parent = window.watermarkTestParent ??= new DateDetailsDialogModal(() => {}, () => {});
  parent.open(`${options.year ?? 2026}-09-28`, [], options.khmer);
  parent.setTime('12:00');
  document.querySelector(`[data-astrology="${options.kind}"]`).click();
  await document.fonts.ready;
  await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
  const dialog = document.querySelector('.astrology-details-dialog');
  const surface = rect(dialog), style = getComputedStyle(dialog);
  const actions = rect(dialog.querySelector('.astrology-details-actions'));
  check(near(surface.bottom - actions.bottom, parseFloat(style.paddingBottom)), 'Artwork must not add footer space');
  for (const button of dialog.querySelectorAll('button')) {
    const bounds = rect(button);
    check(bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth,
      'Action buttons must remain inside the viewport');
  }
  const watermark = dialog.querySelector('.tinted-watermark');
  if (options.year === 1850) check(!watermark, 'Unsupported Year must omit its watermark');
  else {
    check(Boolean(watermark), 'Expected a sign watermark');
    if (watermark) {
      const image = rect(watermark), mask = getComputedStyle(watermark);
      const gaps = [image.left - surface.left, image.top - surface.top,
        surface.right - image.right, surface.bottom - image.bottom];
      check(gaps.every(gap => gap >= 11.25), `Entire watermark must clear popup edges: ${JSON.stringify(gaps)}`);
      check(mask.maskSize === 'contain' && mask.maskRepeat === 'no-repeat', 'Fit all artwork with its original proportions');
      const asset = new Image();
      asset.src = mask.maskImage.match(/url\(["']?(.*?)["']?\)/)[1];
      await asset.decode();
      check(asset.naturalWidth > 0 && asset.naturalHeight > 0, 'Watermark artwork must load');
      watermark.remove();
      const without = rect(dialog);
      check(near(surface.height, without.height) && near(surface.width, without.width), 'Decoration must not size the dialog');
      dialog.prepend(watermark);
    }
  }
  return { errors };
}
