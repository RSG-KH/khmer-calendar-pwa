import { CalendarWords } from '../data/i18n';

/** Switch the entire Khmer month together; cell heights and font sizes never change. */
export function fitLunarLabels(grid: HTMLElement, khmer: boolean): () => void {
  if (!khmer) return () => {};
  const labels = [...grid.querySelectorAll<HTMLElement>('.cell-lunar-label')];
  let active = true;
  let frame = 0;
  const fit = () => {
    if (!active || !grid.isConnected) return;
    let compact = false;
    for (const label of labels) {
      label.textContent = label.dataset.fullLunar!;
      const range = document.createRange();
      range.selectNodeContents(label);
      if (range.getBoundingClientRect().width > label.parentElement!.clientWidth - 4) compact = true;
    }
    if (compact) for (const label of labels) {
      label.textContent = CalendarWords.lunarCompact(Number(label.dataset.lunarDay), label.dataset.waxing === 'true', true);
    }
    grid.toggleAttribute('data-compact-lunar', compact);
  };
  const schedule = () => { if (active) { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); } };
  const observer = new ResizeObserver(schedule);
  observer.observe(grid);
  void document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  fit();
  return () => {
    active = false;
    observer.disconnect();
    cancelAnimationFrame(frame);
    document.fonts.removeEventListener('loadingdone', schedule);
  };
}
