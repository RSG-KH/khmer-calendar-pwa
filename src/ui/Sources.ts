import { L } from '../data/i18n';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';
import appLicense from '../../LICENSE?raw';
import attributionNotice from '../../public/NOTICE.txt?raw';
import fontLicense from '../../public/fonts/OFL.txt?raw';
import engineLicense from '../../public/engine-LICENSE.txt?raw';
import engineNotice from '../../public/engine-NOTICE.txt?raw';

export function showCalendarSources(k: boolean): () => void {
  const text = (key: string) => escapeHtml(L.text(key, k));
  const link = (url: string, label = url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  const license = (title: string, content: string) => `<section class="source-license"><h3>${escapeHtml(title)}</h3><pre>${escapeHtml(content)}</pre></section>`;
  const engineDescription = text('about.calendar_engine').replace('Khmer Calendar Engine',
    link('https://github.com/RSG-KH/khmer-calendar-engine', 'Khmer Calendar Engine'));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog-surface sources-dialog">
      <h2>${text('ui.calendar_sources.7f962e')}</h2>
      <div class="sources-content">
        <p class="sources-update">${text('ui.new_event_years_and_corrections_are_delivered_through_a.a6af2d')}</p>
        <p>${text('rules.source_summary')}</p>
        <p>${engineDescription}</p>
        <details class="source-licenses">
          <summary>${text('ui.open_source_license.ab00af')}</summary>
          ${license(`${L.text('app.name', k)} · Apache-2.0`, `${attributionNotice}\n\n${appLicense}`)}
          ${license('Khmer Calendar Engine · Apache-2.0 / MIT', `${engineLicense}\n\n${engineNotice}`)}
          ${license('Kantumruy Pro · SIL Open Font License 1.1', fontLicense)}
        </details>
      </div>
      <div class="sources-footer"><button class="btn-today-pill sources-close">${text('ui.close.7df7dc')}</button></div>
    </div>`;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    hideModal(overlay);
    overlay.remove();
  };
  setupModal(overlay, close);
  overlay.querySelector('.sources-close')!.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  showModal(overlay, L.text('ui.calendar_sources.7f962e', k));
  return close;
}
