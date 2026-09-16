export interface TodayState { date: string; zoneKey: string }

type TimerHost = Pick<Window, 'setInterval' | 'clearInterval' | 'addEventListener' | 'removeEventListener' | 'queueMicrotask'>;
type VisibilityHost = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

/** UI-only polling. A blocked modal retains its draft; closing it retries immediately. */
export function startTodayRefresh(
  read: () => TodayState,
  changed: (current: TodayState, previous: TodayState) => void,
  blocked: () => boolean,
  host: TimerHost = window,
  visibility: VisibilityHost = document
) {
  let previous = read();
  let interval: number | undefined;
  let pageHidden = false;
  let disposed = false;
  const refresh = () => {
    if (disposed || pageHidden || visibility.hidden) return;
    const current = read();
    if ((current.date === previous.date && current.zoneKey === previous.zoneKey) || blocked()) return;
    const before = previous;
    previous = current;
    changed(current, before);
  };
  const stop = () => {
    if (interval !== undefined) host.clearInterval(interval);
    interval = undefined;
  };
  const resume = () => {
    stop();
    if (disposed || visibility.hidden || pageHidden) return;
    refresh();
    interval = host.setInterval(refresh, 30_000);
  };
  const hide = () => { pageHidden = true; stop(); };
  const show = () => { pageHidden = false; resume(); };
  const modalClosed = () => host.queueMicrotask(refresh);
  visibility.addEventListener('visibilitychange', resume);
  visibility.addEventListener('calendar-modal-closed', modalClosed);
  host.addEventListener('pagehide', hide);
  host.addEventListener('pageshow', show);
  host.addEventListener('focus', refresh);
  resume();
  return {
    reset() { previous = read(); },
    dispose() {
      disposed = true;
      stop();
      visibility.removeEventListener('visibilitychange', resume);
      visibility.removeEventListener('calendar-modal-closed', modalClosed);
      host.removeEventListener('pagehide', hide);
      host.removeEventListener('pageshow', show);
      host.removeEventListener('focus', refresh);
    }
  };
}
