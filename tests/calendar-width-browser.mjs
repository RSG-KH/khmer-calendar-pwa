// Run against `npm run dev`: node tests/calendar-width-browser.mjs [URL]
// Uses an isolated Chromium profile; set BROWSER_PATH if Edge/Chrome is elsewhere.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const browserPath = [process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
assert.ok(browserPath, 'Set BROWSER_PATH to a Chromium browser');
const origin = process.argv[2] || 'http://localhost:5173/';
const profile = await mkdtemp(path.join(tmpdir(), 'calendar-width-'));
const browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let attempt = 0; attempt < 150 && !port; attempt++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Browser debugging endpoint did not start');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const loaded = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (call) { clearTimeout(call.timer); message.error ? call.reject(message.error) : call.resolve(message.result); }
    } else if (message.method === 'Page.loadEventFired') loaded.splice(0).forEach(resolve => resolve());
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
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
  const load = async method => {
    const ready = new Promise(resolve => loaded.push(resolve));
    await call(method, method === 'Page.navigate' ? { url: origin } : {});
    await ready;
  };
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.layoutErrors = [];
    window.addEventListener('error', event => window.layoutErrors.push(event.message));
    window.layoutObservers = new Set();
    const NativeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeObserver {
      observe(...args) { window.layoutObservers.add(this); return super.observe(...args); }
      disconnect() { window.layoutObservers.delete(this); super.disconnect(); }
    };
  ` });
  await load('Page.navigate');
  const profiles = [
    { name: 'small phone portrait', width: 320, height: 640, phone: true, row: 52 },
    { name: 'phone landscape', width: 844, height: 390, phone: true, row: 47 },
    { name: 'tablet portrait', width: 800, height: 1280, native: true, row: 56 },
    { name: 'tablet landscape', width: 1280, height: 800, native: true, row: 50 },
    { name: 'wide desktop', width: 1920, height: 1080, row: 50 },
    { name: 'short desktop', width: 1280, height: 480, row: 40 },
    { name: 'short narrow window', width: 700, height: 380, row: 47 },
  ];
  let checks = 0;
  for (const viewport of profiles) for (const font of [0.8, 1, 1.5]) for (const language of ['en', 'km']) {
    await call('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
    await evaluate(`localStorage.setItem('khmer_calendar_settings', ${JSON.stringify(JSON.stringify({
      language, fontScale: font, theme: language === 'km' ? 'dark' : 'light', mondayFirst: false,
      showLongerWeekdayNames: true, useEmojiForWesternZodiac: language === 'km', useEmojiForGanzhiAnimals: language === 'km'
    }))}); localStorage.setItem('khmer_calendar_custom_events', ${JSON.stringify(JSON.stringify([
      { id: 'width-check', title: 'Personal event', date: '2026-04-08', time: '12:00' }
    ]))});`);
    await load('Page.reload');
    const result = await evaluate(`(${inspect.toString()})(${JSON.stringify({ ...viewport, font })})`);
    assert.equal(result.errors.length, 0, `${viewport.name} ${language} ${font}: ${result.errors.join('; ')}`);
    checks++;
    console.log(`PASS ${viewport.name} ${language} ${font * 100}%: card ${result.cardWidth}px, events ${result.eventsWidth}px`);
    if (process.env.CALENDAR_SCREENSHOT && viewport.name === 'tablet portrait' && font === 1 && language === 'km') {
      const shot = await call('Page.captureScreenshot', { format: 'png' });
      await writeFile(process.env.CALENDAR_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
  }
  console.log(`Passed ${checks} browser profiles: stable month widths, first-frame sizing, certified rows, 2x cap, side gaps and cleanup.`);
} finally {
  socket?.close();
  browser.kill();
  await delay(500);
  // Remove only this script's own temporary browser profile.
  const resolved = await realpath(profile);
  const tempRoot = await realpath(tmpdir());
  if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('calendar-width-')) {
    await rm(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}

async function inspect(profile) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const near = (a, b) => Math.abs(a - b) <= 1;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const root = document.documentElement;
  root.toggleAttribute('data-phone', Boolean(profile.phone));
  root.toggleAttribute('data-auto-hide-scrollbars', !profile.native && !profile.phone);
  if (profile.native || profile.phone) {
    // Simulate Android/Apple overlay scrollbars in desktop Chromium (no layout gutter).
    const overlayScrollbars = document.createElement('style');
    overlayScrollbars.textContent = '.screen-container,.calendar-col-left,.calendar-col-right { scrollbar-width:none; }';
    document.head.appendChild(overlayScrollbars);
  }
  await document.fonts.ready;
  await nextFrame(); await nextFrame();
  document.querySelector('.btn-jump-month').click();
  const picker = document.querySelector('.month-picker-dialog');
  const year = picker.querySelector('.year-display');
  year.value = '2026'; year.dispatchEvent(new Event('input', { bubbles: true }));
  picker.querySelectorAll('.month-picker-cell')[1].click();
  picker.querySelector('.btn-confirm-year').click();
  await nextFrame(); await nextFrame();
  const sample = () => {
    const layout = document.querySelector('.calendar-two-columns');
    const rect = selector => layout.querySelector(selector).getBoundingClientRect();
    const card = rect('.calendar-month-card');
    const events = rect('.calendar-col-right > .events-list-container');
    const cell = rect('.cal-cell');
    check(near(cell.height, profile.row * profile.font), `Certified row height changed: ${cell.height}`);
    check(document.querySelectorAll('.calendar-width-reference').length === 1, 'Sizing references accumulate');
    check(document.querySelector('.calendar-width-reference').inert, 'Sizing reference must be inert');
    check(root.scrollWidth <= innerWidth, 'Horizontal page overflow');
    if (getComputedStyle(layout).display === 'grid') {
      check(events.width <= card.width * (profile.phone ? 1 : 2) + 1, 'Monthly events exceed their width cap');
      if (profile.width === 1920 && profile.font <= 1) check(near(events.width, card.width * 2), 'Wide desktop should expand events to 2x when space allows');
    }
    const monthHeader = layout.querySelector('.calendar-month-events-header');
    if (monthHeader) {
      if (profile.height >= profile.width) {
        check(getComputedStyle(monthHeader).display === 'none', 'Monthly events header must be hidden in portrait mode');
      } else {
        check(getComputedStyle(monthHeader).display !== 'none', 'Monthly events header must remain visible in landscape mode');
      }
    }
    const container = layout.parentElement;
    const outer = container.getBoundingClientRect();
    const content = layout.getBoundingClientRect();
    const padding = getComputedStyle(container);
    const left = outer.left + container.clientLeft + parseFloat(padding.paddingLeft);
    const right = outer.left + container.clientLeft + container.clientWidth - parseFloat(padding.paddingRight);
    if (getComputedStyle(layout).display === 'grid' && !profile.phone) {
      check(near(events.width, card.width * 2) || near(content.width, right - left),
        'Monthly events must fill available space until reaching the 2x cap');
    }
    check(near(content.left - left, right - content.right), 'Columns must stay centered in the available content area');
    check(content.left >= left - 1 && content.right <= right + 1 && parseFloat(padding.paddingLeft) > 0,
      'Keep existing outer breathing room');
    return { cardWidth: card.width, cardLeft: card.left, height: card.height, eventsWidth: events.width, eventsLeft: events.left,
      rows: layout.querySelectorAll('.month-grid-cells > .cal-cell').length / 7 };
  };
  const baseline = sample();
  const observers = window.layoutObservers.size;
  const heights = [baseline.height];
  check(baseline.rows === 4, 'February must display four rows');
  for (const [index, direction] of [1, 1, 1, -1, -1, -1].entries()) {
    document.querySelector(direction === 1 ? '.btn-next-month' : '.btn-prev-month').click();
    const first = sample();
    for (const key of ['cardWidth', 'cardLeft', 'eventsWidth', 'eventsLeft']) check(near(first[key], baseline[key]), `Month changes ${key}: ${baseline[key]} to ${first[key]}`);
    heights.push(first.height);
    if (index === 0) check(first.rows === 5, 'March must display five rows');
    if (index === 2) check(first.rows === 6, 'May must display six rows');
    for (let frame = 0; frame < 3; frame++) {
      await nextFrame();
      const after = sample();
      for (const key of ['cardWidth', 'cardLeft', 'eventsWidth', 'eventsLeft']) check(near(first[key], after[key]), `Delayed resize: ${key}`);
    }
    check(window.layoutObservers.size === observers, 'Resize observers accumulate across months');
  }
  check(heights[0] < heights[1] && heights[1] < heights[3], 'Only height should follow four/five/six rows');
  document.querySelector('[data-page="1"]').click();
  check(!document.querySelector('.calendar-width-reference'), 'Leaving Calendar must remove the sizing reference');
  check(window.layoutObservers.size < observers, 'Leaving Calendar must disconnect sizing observers');
  document.querySelector('[data-page="0"]').click();
  await nextFrame(); await nextFrame();
  check(window.layoutObservers.size === observers, 'Returning to Calendar must restore one set of observers');
  errors.push(...window.layoutErrors);
  return { errors: [...new Set(errors)], cardWidth: baseline.cardWidth, eventsWidth: baseline.eventsWidth };
}
