import { escapeHtml } from './html';

export function settingsPicker(id: string, value: string, options: string[][]): string {
  const selected = options.find(option => option[0] === value) ?? options[0];
  return `<div class="settings-picker">
    <button type="button" class="settings-select" id="${id}" aria-labelledby="${id}-label ${id}-value" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}-menu">
      <span id="${id}-value">${escapeHtml(selected[1])}</span>
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none" aria-hidden="true"><path d="m3 6 3-3 3 3M3 10l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="settings-picker-menu" id="${id}-menu" role="menu" aria-labelledby="${id}-label" hidden>
      ${options.map(([key, label]) => `<button type="button" class="settings-picker-option" role="menuitemradio" aria-checked="${key === selected[0]}" tabindex="-1" data-value="${escapeHtml(key)}">
        <span>${escapeHtml(label)}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`).join('')}
    </div>
  </div>`;
}

export function setupSettingsPickers(container: HTMLElement, onChange: (id: string, value: string) => void, maxMenuHeight = Infinity): () => void {
  let closeActive: (() => void) | undefined;
  const cleanups: (() => void)[] = [];

  container.querySelectorAll<HTMLElement>('.settings-picker').forEach(picker => {
    const trigger = picker.querySelector<HTMLButtonElement>('.settings-select')!;
    const menu = picker.querySelector<HTMLElement>('.settings-picker-menu')!;
    const options = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    let openListeners: AbortController | undefined;
    let typed = '';
    let lastTyped = 0;

    const close = (restoreFocus = false) => {
      openListeners?.abort();
      openListeners = undefined;
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
    };
    cleanups.push(close);

    const focusOption = (option: HTMLButtonElement) => {
      // Only scroll the menu: browser focus scrolling can also move the dialog
      // and trigger the outside-scroll handler that dismisses this popup.
      option.focus({ preventScroll: true });
      const top = option.offsetTop;
      const bottom = top + option.offsetHeight;
      if (top < menu.scrollTop) menu.scrollTop = top;
      else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
    };

    const open = () => {
      closeActive?.();
      closeActive = close;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      typed = '';

      // Native iPad select popups have an OS-controlled width. This menu uses
      // its longest label, then stays within the visible viewport near its button.
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const right = left + (viewport?.width ?? window.innerWidth) - 16;
      const bottom = top + (viewport?.height ?? window.innerHeight) - 16;
      menu.style.maxWidth = `${right - left}px`;
      menu.style.maxHeight = `${Math.min(bottom - top, maxMenuHeight)}px`;
      const anchor = trigger.getBoundingClientRect();
      const bounds = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(left, Math.min(anchor.right - bounds.width, right - bounds.width))}px`;
      const below = anchor.bottom + 6;
      const above = anchor.top - bounds.height - 6;
      menu.style.top = `${Math.max(top, Math.min(below + bounds.height <= bottom ? below : above, bottom - bounds.height))}px`;

      focusOption(options.find(option => option.getAttribute('aria-checked') === 'true')!);
      openListeners = new AbortController();
      const { signal } = openListeners;
      document.addEventListener('pointerdown', event => {
        if (!picker.contains(event.target as Node)) close(menu.contains(document.activeElement));
      }, { signal });
      document.addEventListener('focusin', event => {
        if (!picker.contains(event.target as Node)) close();
      }, { signal });
      window.addEventListener('resize', () => close(true), { signal });
      viewport?.addEventListener('resize', () => close(true), { signal });
      viewport?.addEventListener('scroll', () => close(true), { signal });
      document.addEventListener('scroll', event => {
        if (!menu.contains(event.target as Node)) close(true);
      }, { capture: true, signal });
    };

    trigger.addEventListener('click', () => menu.hidden ? open() : close(true));
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open();
      }
    });
    menu.addEventListener('keydown', event => {
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      let next: number | undefined;
      if (event.key === 'ArrowDown') next = (index + 1) % options.length;
      if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      // Return to the trigger before the browser moves to the next/previous control.
      if (event.key === 'Tab') close(true);
      if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const now = performance.now();
        typed = (now - lastTyped < 600 ? typed : '') + event.key.toLocaleLowerCase();
        lastTyped = now;
        const match = options.findIndex(option => option.textContent!.trim().toLocaleLowerCase().startsWith(typed));
        if (match >= 0) next = match;
      }
      if (next !== undefined) { event.preventDefault(); focusOption(options[next]); }
    });
    options.forEach(option => option.addEventListener('click', () => {
      close(true);
      onChange(trigger.id, option.dataset.value!);
      // Saving settings rebuilds the screen, including the original trigger.
      document.getElementById(trigger.id)?.focus({ preventScroll: true });
    }));
  });

  return () => cleanups.forEach(cleanup => cleanup());
}
