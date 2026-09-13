// iOS can shrink and pan the visual viewport without resizing the layout
// viewport. Track the visible rectangle instead of guessing keyboard height.
export function trackModalViewport(overlay: HTMLElement, host: Window = window): () => void {
  const viewport = host.visualViewport;
  let frame = 0;
  const update = () => {
    frame = 0;
    overlay.style.setProperty('--modal-left', `${viewport?.offsetLeft ?? 0}px`);
    overlay.style.setProperty('--modal-top', `${viewport?.offsetTop ?? 0}px`);
    overlay.style.setProperty('--modal-width', `${viewport?.width ?? host.innerWidth}px`);
    overlay.style.setProperty('--modal-height', `${viewport?.height ?? host.innerHeight}px`);
    overlay.classList.toggle('modal-compact', (viewport?.height ?? host.innerHeight) < 440);
  };
  const schedule = () => {
    if (!frame) frame = host.requestAnimationFrame(update);
  };
  update();
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  host.addEventListener('resize', schedule);

  return () => {
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    host.removeEventListener('resize', schedule);
    if (frame) host.cancelAnimationFrame(frame);
    for (const property of ['left', 'top', 'width', 'height']) overlay.style.removeProperty(`--modal-${property}`);
    overlay.classList.remove('modal-compact');
  };
}
