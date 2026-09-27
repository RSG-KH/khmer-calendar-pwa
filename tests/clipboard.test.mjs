import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
after(() => server.close());
const { copyText } = await server.ssrLoadModule('/src/ui/Clipboard.ts');
const { setupCopyButton } = await server.ssrLoadModule('/src/ui/CopyButton.ts');

function fixture(writeText) {
  class Element extends EventTarget {
    isConnected = true;
    children = [];
    style = {};
    attributes = new Map();
    classes = new Set();
    classList = { add: key => this.classes.add(key), remove: key => this.classes.delete(key), contains: key => this.classes.has(key) };
    appendChild(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.isConnected = false; }
    focus() { document.activeElement = this; }
    closest() { return modal; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector() { return icon; }
  }
  class Input extends Element {
    value = '';
    selectionStart = 1;
    selectionEnd = 3;
    selectionDirection = 'backward';
    select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
    setSelectionRange(start, end, direction = 'none') { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }
  }
  const button = new Element(), modal = new Element(), icon = new Element(), status = new Element();
  const selectedRange = { commonAncestorContainer: { isConnected: true }, cloneRange() { return this; } };
  let ranges = [selectedRange];
  const selection = { get rangeCount() { return ranges.length; }, getRangeAt: index => ranges[index], removeAllRanges: () => { ranges = []; }, addRange: range => ranges.push(range) };
  const copied = [];
  let allowed = true;
  globalThis.HTMLElement = Element;
  globalThis.HTMLInputElement = Input;
  globalThis.HTMLTextAreaElement = Input;
  globalThis.document = {
    activeElement: button, body: new Element(), getSelection: () => selection,
    createElement: tag => { assert.equal(tag, 'textarea'); return new Input(); },
    execCommand: command => {
      assert.equal(command, 'copy');
      const field = document.activeElement;
      assert.equal(field.parent, modal, 'Copy selection belongs to the active modal, not the inert app');
      assert.equal(field.readOnly, true);
      assert.equal(field.selectionStart, 0);
      assert.equal(field.selectionEnd, field.value.length);
      copied.push(field.value);
      return allowed;
    }
  };
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
  const timers = new Map();
  let nextTimer = 0;
  globalThis.window = { setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: id => timers.delete(id) };
  return { button, modal, status, copied, timers, Input, selectedRange, selection, deny: () => { allowed = false; } };
}

test('modern clipboard write starts synchronously in the click gesture without a temporary selection', async () => {
  const writes = [];
  const f = fixture(text => { writes.push(text); return Promise.resolve(); });
  const pending = copyText('ខ្មែរ\nEnglish', f.button);
  assert.deepEqual(writes, ['ខ្មែរ\nEnglish']);
  await pending;
  assert.deepEqual(f.copied, []);
  assert.equal(f.modal.children.length, 0);
});

test('missing and rejected clipboard APIs fall back, preserving text, focus, selection and input caret', async () => {
  for (const writeText of [undefined, () => Promise.reject(new Error('Denied'))]) {
    const f = fixture(writeText);
    const field = new f.Input();
    field.value = 'Existing field';
    field.focus();
    await copyText('ខ្មែរ\nhttps://example.com/?a=1&b=2', f.button);
    assert.deepEqual(f.copied, ['ខ្មែរ\nhttps://example.com/?a=1&b=2']);
    assert.equal(document.activeElement, field);
    assert.deepEqual([field.selectionStart, field.selectionEnd, field.selectionDirection], [1, 3, 'backward']);
    assert.equal(f.selection.getRangeAt(0), f.selectedRange);
    assert.equal(f.modal.children.length, 0);
  }
});

test('an unsuccessful fallback reports failure and removes the temporary field', async () => {
  const f = fixture();
  f.deny();
  await assert.rejects(copyText('Keep error visible', f.button), /not permitted/);
  assert.equal(document.activeElement, f.button);
  assert.equal(f.modal.children.length, 0);
  assert.equal(f.selection.getRangeAt(0), f.selectedRange);
});

test('a dismissed popup does not start a fallback after a delayed clipboard rejection', async () => {
  let reject;
  const f = fixture(() => new Promise((_, fail) => { reject = fail; }));
  const pending = copyText('Closed', f.button);
  f.button.isConnected = false;
  reject(new Error('Denied'));
  await assert.rejects(pending, /no longer active/);
  assert.deepEqual(f.copied, []);
  assert.equal(f.modal.children.length, 0);
});

test('copy-button feedback is truthful, retryable, and its timer is released on disposal', async () => {
  const f = fixture();
  const dispose = setupCopyButton(f.button, f.status, 'A title', { copied: 'Copied', failed: 'Failed' });
  f.button.dispatchEvent(new Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.status.textContent, 'Copied');
  assert.equal(f.button.classList.contains('copied'), true);
  assert.equal(f.timers.size, 1);
  f.deny();
  f.button.dispatchEvent(new Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.status.textContent, 'Failed');
  assert.equal(f.button.classList.contains('copied'), false);
  assert.equal(f.status.classList.contains('copy-error'), true);
  assert.equal(f.button.attributes.has('aria-busy'), false);
  dispose();
  assert.equal(f.timers.size, 0);
});

test('duplicate clicks share one pending write and disposed controls receive no late feedback', async () => {
  let resolveWrite, writes = 0;
  const f = fixture(() => { writes++; return new Promise(resolve => { resolveWrite = resolve; }); });
  const dispose = setupCopyButton(f.button, f.status, 'A title', { copied: 'Copied', failed: 'Failed' });
  f.button.dispatchEvent(new Event('click'));
  f.button.dispatchEvent(new Event('click'));
  assert.equal(writes, 1);
  dispose();
  resolveWrite();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.status.textContent, '');
  assert.equal(f.timers.size, 0);
});
