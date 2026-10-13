/** Keep headings centered and at one size, using the gaps between actual labels. */
export function fitWeekdayHeadings(row: HTMLElement): () => void {
  let active = true;
  let frame = 0;
  const fit = () => {
    if (!active || !row.isConnected) return;
    row.style.removeProperty('font-size');
    const preferred = parseFloat(getComputedStyle(row).fontSize);
    const spans = [...row.querySelectorAll<HTMLElement>('span')];
    const bounds = row.getBoundingClientRect();
    if (row.clientWidth <= 0 || bounds.width <= 0 || !spans.length) return;
    // Compare visual bounds consistently, including in scaled device previews.
    const pixelScale = bounds.width / row.clientWidth;
    const edgeInset = 2 * pixelScale;
    const gap = 4 * pixelScale;
    const labels = spans.map(span => {
      const range = document.createRange();
      range.selectNodeContents(span);
      const cell = span.getBoundingClientRect();
      return { center: (cell.left + cell.right) / 2, width: range.getBoundingClientRect().width };
    });
    let scale = 1;
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      if (label.width > 0) {
        const toEdge = Math.min(label.center - bounds.left, bounds.right - label.center) - edgeInset;
        scale = Math.min(scale, 2 * toEdge / label.width);
      }
      const next = labels[index + 1];
      if (next && label.width + next.width > 0) {
        scale = Math.min(scale, 2 * (next.center - label.center - gap) / (label.width + next.width));
      }
    }
    if (scale > 0 && scale < 1) row.style.fontSize = `${preferred * scale}px`;
  };
  const schedule = () => { if (active) { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); } };
  const observer = new ResizeObserver(schedule);
  observer.observe(row);
  void document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  schedule();
  return () => {
    active = false;
    observer.disconnect();
    cancelAnimationFrame(frame);
    document.fonts.removeEventListener('loadingdone', schedule);
  };
}
