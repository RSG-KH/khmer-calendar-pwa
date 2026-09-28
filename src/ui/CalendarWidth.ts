/** Resolve a stable five-row width before paint, independent of month/event count. */
export function fitCalendarWidth(layout: HTMLElement, card: HTMLElement): () => void {
  const container = layout.parentElement!;
  const reference = card.cloneNode(false) as HTMLElement;
  reference.classList.add('calendar-width-reference');
  reference.setAttribute('aria-hidden', 'true');
  reference.inert = true;

  const headings = card.querySelector<HTMLElement>('.weekdays-row')!.cloneNode(true) as HTMLElement;
  headings.style.removeProperty('font-size');
  const grid = card.querySelector<HTMLElement>('.month-grid-cells')!.cloneNode(false) as HTMLElement;
  // Share the certified CSS cell heights without copying dates, artwork or handlers.
  for (let row = 0; row < 5; row++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    cell.style.gridColumn = '1 / -1';
    grid.appendChild(cell);
  }
  const legend = card.querySelector<HTMLElement>('.card-legend-row')!.cloneNode(true) as HTMLElement;
  legend.classList.remove('tight-legend');
  legend.querySelector('.mark-shape.custom')?.closest('.legend-item')?.remove();
  reference.append(headings, grid, card.querySelector('.card-divider')!.cloneNode(false), legend);
  container.appendChild(reference);

  let active = true;
  const set = (name: string, value: string) => {
    if (layout.style.getPropertyValue(name) !== value) layout.style.setProperty(name, value);
  };
  const fit = () => {
    if (!active || !layout.isConnected) return;
    const style = getComputedStyle(container);
    const available = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const columns = getComputedStyle(layout);
    const landscape = columns.display === 'grid';
    const gap = parseFloat(columns.columnGap) || 0;
    const gutters = Math.max(0, card.parentElement!.getBoundingClientRect().width - card.getBoundingClientRect().width);
    const width = Math.max(0, (landscape ? (available - gap) / 2 : Math.min(640, available)) - gutters);
    reference.style.width = `${width}px`;
    const height = reference.getBoundingClientRect().height;
    if (height > 0) {
      set('--calendar-column-gutters', `${gutters}px`);
      set('--calendar-max-width', `${height * 1.25 + gutters}px`);
    }
  };
  // Observe the viewport, never the capped card or the reference that fit resizes.
  // Run synchronously before paint, including after fonts finish loading.
  const observer = new ResizeObserver(fit);
  fit();
  observer.observe(container);
  void document.fonts.ready.then(fit);
  document.fonts.addEventListener('loadingdone', fit);
  return () => {
    active = false;
    observer.disconnect();
    document.fonts.removeEventListener('loadingdone', fit);
    reference.remove();
    layout.style.removeProperty('--calendar-max-width');
    layout.style.removeProperty('--calendar-column-gutters');
  };
}
