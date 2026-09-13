import { trackModalViewport } from './ModalViewport';

const previousFocus = new WeakMap<HTMLElement, HTMLElement>();
const viewportCleanup = new WeakMap<HTMLElement, () => void>();
const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]';

export function setupModal(overlay: HTMLElement, onClose: () => void) {
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const elements = Array.from(overlay.querySelectorAll<HTMLElement>(focusableSelector)).filter(element => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) { event.preventDefault(); overlay.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
}

export function showModal(overlay: HTMLElement, label: string) {
  viewportCleanup.get(overlay)?.();
  viewportCleanup.set(overlay, trackModalViewport(overlay));
  if (document.activeElement instanceof HTMLElement) previousFocus.set(overlay, document.activeElement);
  overlay.setAttribute('aria-label', label);
  overlay.classList.add('open');
  document.getElementById('app')!.inert = true;
  // Focus the sheet, preserving its top and avoiding an unwanted mobile keyboard.
  overlay.focus({ preventScroll: true });
}

export function hideModal(overlay: HTMLElement) {
  overlay.classList.remove('open');
  viewportCleanup.get(overlay)?.();
  viewportCleanup.delete(overlay);
  if (document.querySelector('.modal-overlay.open')) return;
  document.getElementById('app')!.inert = false;
  const previous = previousFocus.get(overlay);
  if (previous?.isConnected) previous.focus({ preventScroll: true });
  else document.querySelector<HTMLElement>('[data-page].active')?.focus({ preventScroll: true });
}
