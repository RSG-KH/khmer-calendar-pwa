/** Center a month over its date column only when the loaded text fits there. */
export function fitEventMonthHeadings(container: HTMLElement): () => void {
  let active = true;
  let frame = 0;
  const fit = () => {
    if (!active || !container.isConnected) return;
    const measurements = [...container.querySelectorAll<HTMLElement>('.events-month-name')].map(name => {
      const title = name.parentElement!;
      const date = title.parentElement!.querySelector<HTMLElement>('.event-row-date')!;
      const dateBounds = date.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(name);
      return {
        name, width: dateBounds.width,
        offset: dateBounds.left - title.getBoundingClientRect().left - parseFloat(getComputedStyle(title).paddingLeft),
        fits: dateBounds.width > 0 && range.getBoundingClientRect().width <= dateBounds.width
      };
    });
    for (const { name, width, offset, fits } of measurements) {
      name.style.setProperty('--month-date-width', `${width}px`);
      name.style.setProperty('--month-date-offset', `${offset}px`);
      name.classList.toggle('is-centered', fits);
    }
  };
  const schedule = () => { if (active) { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); } };
  const observer = new ResizeObserver(schedule);
  observer.observe(container);
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
