/** Use one size for all seven labels, measured after the selected font loads. */
export function fitWeekdayHeadings(row: HTMLElement): () => void {
  let active = true;
  let frame = 0;
  const fit = () => {
    if (!active || !row.isConnected) return;
    row.style.removeProperty('font-size');
    const preferred = parseFloat(getComputedStyle(row).fontSize);
    const spans = [...row.querySelectorAll<HTMLElement>('span')];
    const available = row.clientWidth / 7 - 2;
    if (available <= 0) return;
    const widest = Math.max(...spans.map(span => {
      const range = document.createRange();
      range.selectNodeContents(span);
      return range.getBoundingClientRect().width;
    }));
    if (widest > available) row.style.fontSize = `${preferred * available / widest}px`;
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
