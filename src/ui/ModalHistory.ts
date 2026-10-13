const stateKey = '__khmerCalendarModal';

function modalDepth(state: unknown): number {
  const depth = (state as Record<string, { depth?: unknown }> | null)?.[stateKey]?.depth;
  return typeof depth === 'number' && Number.isSafeInteger(depth) && depth > 0 ? depth : 0;
}

/** One same-document history entry per open popup, without serializing drafts. */
export class ModalHistory {
  private stack: { key: object; close: () => void }[] = [];
  private depth: number;
  private traversing = false;
  private scheduled = false;
  private disposed = false;

  constructor(private host: Window) {
    this.depth = modalDepth(host.history.state);
    host.addEventListener('popstate', this.onPopState);
    // Reloading does not restore popup drafts; retire their old entries as well.
    this.sync();
  }

  show(key: object, close: () => void): void {
    if (this.stack.some(entry => entry.key === key)) return;
    this.stack.push({ key, close });
    this.sync();
  }

  hide(key: object): void {
    const index = this.stack.findIndex(entry => entry.key === key);
    if (index < 0) return;
    this.stack.splice(index, 1);
    // Batch child disposal and close-then-open actions before traversing history.
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.sync();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.host.removeEventListener('popstate', this.onPopState);
    this.stack = [];
  }

  private onPopState = (event: PopStateEvent) => {
    const previousDepth = this.depth;
    this.depth = modalDepth(event.state);
    if (this.traversing) {
      // Close/Save already updated the UI. A new popup may have opened while
      // history.go was pending; do not close it when that traversal completes.
      this.traversing = false;
    } else if (this.depth < previousDepth) {
      while (this.stack.length > this.depth) {
        const entry = this.stack.pop()!;
        entry.close();
      }
    }
    this.sync();
  };

  private sync(): void {
    if (this.disposed || this.traversing) return;
    if (this.depth > this.stack.length) {
      this.traversing = true;
      this.host.history.go(this.stack.length - this.depth);
      return;
    }
    while (this.depth < this.stack.length) {
      const depth = this.depth + 1;
      this.host.history.pushState({ ...this.host.history.state, [stateKey]: { depth } }, '');
      this.depth = depth;
    }
    // Forward into a dismissed popup is retired by the same traversal above;
    // closed editors are never resurrected and normal Back works at depth zero.
  }
}

const histories = new WeakMap<Window, ModalHistory>();

export function initializeModalHistory(host: Window = window): ModalHistory | undefined {
  if (!host.history) return;
  let history = histories.get(host);
  if (!history) {
    history = new ModalHistory(host);
    histories.set(host, history);
  }
  return history;
}
