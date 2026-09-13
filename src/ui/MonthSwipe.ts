import { KhmerCalendar } from '../domain/KhmerCalendar';

export type MonthDirection = -1 | 1;

export function adjacentMonth(year: number, month: number, direction: MonthDirection) {
  const index = year * 12 + month - 1 + direction;
  const nextYear = Math.floor(index / 12);
  if (nextYear < KhmerCalendar.minYear || nextYear > KhmerCalendar.maxYear) return null;
  return { year: nextYear, month: index % 12 + 1 };
}

/** Bind once to the app root so click suppression survives a month re-render. */
export function bindMonthSwipe(root: HTMLElement, onSwipe: (direction: MonthDirection) => void): () => void {
  const doc = root.ownerDocument;
  const host = doc.defaultView;
  let gesture: { id: number; x: number; y: number; card: Element; axis?: 'x' | 'y' } | undefined;
  let suppressClick = false;

  const cancel = () => {
    const id = gesture?.id;
    gesture = undefined;
    if (id !== undefined && root.hasPointerCapture(id)) root.releasePointerCapture(id);
  };

  const down = (event: PointerEvent) => {
    if (gesture) {
      if (event.pointerId !== gesture.id) {
        suppressClick = true;
        cancel();
      }
      return;
    }
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    const card = (event.target as Element | null)?.closest?.('.calendar-month-card');
    if (card && root.contains(card)) {
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, card };
    }
  };

  const move = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!root.contains(gesture.card) || event.buttons === 0) {
      cancel();
      return;
    }
    const dx = Math.abs(event.clientX - gesture.x);
    const dy = Math.abs(event.clientY - gesture.y);
    if (Math.max(dx, dy) < 10) return;
    suppressClick = true;
    if (!gesture.axis) {
      // Lock vertical/diagonal movement out of month navigation for the whole gesture.
      gesture.axis = dx > dy * 1.5 ? 'x' : 'y';
      if (gesture.axis === 'x') root.setPointerCapture(event.pointerId);
    }
  };

  const up = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const completed = gesture;
    gesture = undefined;
    const dx = event.clientX - completed.x;
    const dy = event.clientY - completed.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 10) suppressClick = true;
    // Match Android's 80 dp travel, and require a clearly horizontal release.
    if (root.contains(completed.card) && completed.axis === 'x'
      && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onSwipe(dx < 0 ? 1 : -1);
    }
    // The browser releases capture after pointerup; its ensuing click targets the root.
  };

  const pointerCancel = (event: PointerEvent) => {
    if (gesture?.id === event.pointerId) {
      suppressClick = true;
      cancel();
    }
  };
  const lostCapture = (event: PointerEvent) => {
    if (event.target === root) pointerCancel(event);
  };
  const click = (event: MouseEvent) => {
    if (suppressClick && event.detail !== 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    suppressClick = false;
  };

  // Observe a second finger even when it lands outside the calendar.
  doc.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', pointerCancel);
  root.addEventListener('lostpointercapture', lostCapture);
  root.addEventListener('click', click, true);
  host?.addEventListener('blur', cancel);

  return () => {
    cancel();
    doc.removeEventListener('pointerdown', down, true);
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerup', up);
    doc.removeEventListener('pointercancel', pointerCancel);
    root.removeEventListener('lostpointercapture', lostCapture);
    root.removeEventListener('click', click, true);
    host?.removeEventListener('blur', cancel);
  };
}
