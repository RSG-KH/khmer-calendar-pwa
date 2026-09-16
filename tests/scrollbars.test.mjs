import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { bindAutoHideScrollbars } = await server.ssrLoadModule('/src/ui/Scrollbars.ts');

function fixture() {
  const attributes = new Set();
  const doc = Object.assign(new EventTarget(), {
    documentElement: {
      setAttribute: name => attributes.add(name),
      removeAttribute: name => attributes.delete(name)
    }
  });
  const cleanup = bindAutoHideScrollbars(doc);
  const container = selector => {
    const classes = new Set();
    return {
      matches: selectors => selectors.split(', ').includes(selector),
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      visible: () => classes.has('is-scrolling')
    };
  };
  const scroll = target => {
    const event = new Event('scroll');
    Object.defineProperty(event, 'target', { value: target });
    doc.dispatchEvent(event);
  };
  return { attributes, cleanup, container, scroll };
}

test('calendar columns hide independently and continued scrolling restarts the idle delay', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  const left = f.container('.calendar-col-left');
  const right = f.container('.calendar-col-right');
  assert.equal(left.visible(), false);
  f.scroll(left);
  context.mock.timers.tick(600);
  f.scroll(right);
  f.scroll(left);
  context.mock.timers.tick(600);
  assert.equal(left.visible(), true);
  assert.equal(right.visible(), true);
  f.scroll(right);
  context.mock.timers.tick(300);
  assert.equal(left.visible(), false);
  assert.equal(right.visible(), true);
  context.mock.timers.tick(600);
  assert.equal(right.visible(), false);
  f.cleanup();
});

test('new popup scrollers work after startup and cleanup removes pending effects and listeners', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  const popup = f.container('.sources-content');
  const picker = f.container('.settings-picker-menu');
  const textarea = f.container('textarea');
  const unrelated = f.container('.unrelated');
  f.scroll(null);
  f.scroll(unrelated);
  assert.equal(unrelated.visible(), false);
  for (const target of [popup, picker, textarea]) {
    f.scroll(target);
    assert.equal(target.visible(), true);
  }
  f.cleanup();
  assert.equal(f.attributes.size, 0);
  for (const target of [popup, picker, textarea]) {
    assert.equal(target.visible(), false);
    f.scroll(target);
    assert.equal(target.visible(), false);
  }
  context.mock.timers.tick(1000);
  assert.equal(popup.visible(), false);
});
