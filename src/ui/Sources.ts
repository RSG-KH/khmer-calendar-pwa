import { L } from '../data/i18n';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';
import appLicense from '../../LICENSE?raw';
import calendarNotice from '../../public/NOTICE.txt?raw';
import fontLicense from '../../public/fonts/OFL.txt?raw';

export function showCalendarSources(k: boolean): () => void {
  const text = (key: string) => escapeHtml(L.text(key, k));
  const link = (url: string, label = url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  const license = (title: string, content: string) => `<details class="source-license"><summary>${escapeHtml(title)}</summary><pre>${escapeHtml(content)}</pre></details>`;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog-surface sources-dialog">
      <h2>${text('ui.calendar_sources.7f962e')}</h2>
      <div class="sources-content">
        <p class="sources-update">${text('ui.new_event_years_and_corrections_are_delivered_through_a.a6af2d')}</p>
        <p>${text('ui.events_2000_2030_from_khmer_lunar_calendar_available_of.93ee10')}</p>
        <ul class="sources-links">
          <li>${link('https://library.ncdd.gov.kh/')}</li>
          <li>${link('https://www.ocm.gov.kh/')}</li>
          <li>${link('https://www.nbc.gov.kh/')}</li>
          <li>${link('https://khmer-lunar-calendar.com/', k ? 'ប្រតិទិនចន្ទគតិខ្មែរ' : 'Khmer Chhankitek Calendar')}</li>
        </ul>
        <p>${text('rules.source_summary')}</p>
        <p>${text('ui.lunar_calendar_1900_2100_based_on_work_by_phylypo_tum_t.d8396b')}</p>
        <h3>${text('ui.open_source_license.ab00af')}</h3>
        ${license(`${L.text('app.name', k)} · Apache-2.0`, appLicense)}
        ${license(k ? 'ការគណនាប្រតិទិន · MIT' : 'Calendar calculations · MIT', calendarNotice)}
        ${license('Kantumruy Pro · SIL Open Font License 1.1', fontLicense)}
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
