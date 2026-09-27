/** Cap the month card at 1.25 times its natural height without stretching rows. */
export function fitCalendarWidth(layout: HTMLElement, card: HTMLElement): () => void {
  let frame = 0;
  const fit = () => {
    if (!card.isConnected) return;
    // Measure before capping: a legend that wraps at the capped width must not
    // repeatedly widen the card, unwrap, and shrink it again.
    layout.style.removeProperty('--calendar-max-width');
    const { height, width } = card.getBoundingClientRect();
    // Desktop scrollers reserve gutters outside the card; native overlay
    // scrollbars do not. Cap the visible card equally on both platforms.
    const gutters = card.parentElement!.getBoundingClientRect().width - width;
    if (height > 0) layout.style.setProperty('--calendar-max-width', `${height * 1.25 + gutters}px`);
  };
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  });
  fit();
  observer.observe(card);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    layout.style.removeProperty('--calendar-max-width');
  };
}
