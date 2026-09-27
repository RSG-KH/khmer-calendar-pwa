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
  if (!overlay.classList.contains('open') && document.activeElement instanceof HTMLElement) {
    previousFocus.set(overlay, document.activeElement);
  }
  overlay.setAttribute('aria-label', label);
  overlay.classList.add('open');
  document.getElementById('app')!.inert = true;
  // Focus the sheet, preserving its top and avoiding an unwanted mobile keyboard.
  overlay.focus({ preventScroll: true });
}

export function hideModal(overlay: HTMLElement) {
  const wasOpen = overlay.classList.contains('open');
  overlay.classList.remove('open');
  viewportCleanup.get(overlay)?.();
  viewportCleanup.delete(overlay);
  const previous = previousFocus.get(overlay);
  previousFocus.delete(overlay);
  if (!wasOpen) return;
  const remaining = Array.from(document.querySelectorAll<HTMLElement>('.modal-overlay.open')).at(-1);
  if (remaining) {
    // Closing a child sheet returns keyboard navigation to its parent.
    if (previous?.isConnected && remaining.contains(previous)) previous.focus({ preventScroll: true });
    else remaining.focus({ preventScroll: true });
    return;
  }
  document.getElementById('app')!.inert = false;
  if (previous?.isConnected) previous.focus({ preventScroll: true });
  else document.querySelector<HTMLElement>('[data-page].active')?.focus({ preventScroll: true });
  document.dispatchEvent(new Event('calendar-modal-closed'));
}
