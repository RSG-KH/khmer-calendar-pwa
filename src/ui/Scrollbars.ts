// Copyright (c) 2026 RSG-KH | Apache-2.0 License

const scrollContainers = '.screen-container, .calendar-col-left, .calendar-col-right, '
  + '.modal-dialog-surface, .date-details-content, .sources-content, '
  + '.month-picker-grid, .settings-picker-menu, textarea, .event-editor-form, .event-detail-content';

// Call only when Platform.prefersNativeScrollbars() is false. The attribute opts
// into styles/scrollbars.css, including its balanced gutters and column spacing.
export function bindAutoHideScrollbars(doc: Document = document): () => void {
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  doc.documentElement.setAttribute('data-auto-hide-scrollbars', '');

  // Capture also covers nested scrollers and dialogs created after startup.
  const onScroll = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.matches?.(scrollContainers)) return;
    clearTimeout(timers.get(target));
    target.classList.add('is-scrolling');
    timers.set(target, setTimeout(() => {
      target.classList.remove('is-scrolling');
      timers.delete(target);
    }, 900));
  };
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true });

  return () => {
    doc.removeEventListener('scroll', onScroll, { capture: true });
    doc.documentElement.removeAttribute('data-auto-hide-scrollbars');
    for (const [target, timer] of timers) {
      clearTimeout(timer);
      target.classList.remove('is-scrolling');
    }
    timers.clear();
  };
}
