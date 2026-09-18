import { L } from '../data/i18n';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';
import appLicense from '../../LICENSE?raw';
import attributionNotice from '../../public/NOTICE.txt?raw';
import fontLicense from '../../public/fonts/OFL.txt?raw';
import engineLicense from '../../public/engine-LICENSE.txt?raw';
import engineNotice from '../../public/engine-NOTICE.txt?raw';

function showUrlDialog(title: string, urlText: string, k: boolean): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '110';
  const urls = urlText.split('\n').filter(Boolean);
  const urlLinesHtml = urls.map(u => `<div class="source-url-text">${escapeHtml(u)}</div>`).join('');
  overlay.innerHTML = `
    <div class="modal-dialog-surface source-url-dialog">
      <div class="source-url-title">${escapeHtml(title)}</div>
      <div class="source-url-body">
        ${urlLinesHtml}
      </div>
      <div class="source-url-footer">
        <button type="button" class="btn-today-pill source-url-close">${escapeHtml(L.text('ui.close.7df7dc', k))}</button>
        <button type="button" class="btn-today-pill source-url-copy">${escapeHtml(L.text('ui.copy', k))}</button>
      </div>
    </div>`;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    hideModal(overlay);
    overlay.remove();
  };
  setupModal(overlay, close);
  overlay.querySelector('.source-url-close')!.addEventListener('click', close);
  overlay.querySelector('.source-url-copy')!.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(urlText);
      }
    } catch {
      // restricted environment fallback
    }
    close();
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  showModal(overlay, title);
  return close;
}

export function showCalendarSources(k: boolean): () => void {
  const text = (key: string) => escapeHtml(L.text(key, k));
  const link = (url: string, label = url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  const license = (title: string, content: string) => `<section class="source-license"><h3>${escapeHtml(title)}</h3><pre>${escapeHtml(content)}</pre></section>`;
  const engineDescription = text('about.calendar_engine').replace('Khmer Calendar Engine',
    link('https://github.com/RSG-KH/khmer-calendar-engine', 'Khmer Calendar Engine'));

  const holidayText = L.text('about.public_holiday_source', k);
  const holidayCandidates = k
    ? ['ឯកសារផ្លូវការរបស់រដ្ឋ', 'គេហទំព័រផ្លូវការរបស់រដ្ឋាភិបាល']
    : ['official government publications', 'official government websites'];
  const holidayName = holidayCandidates.find(name => holidayText.includes(name)) || holidayCandidates[0];
  const holidayTitle = L.text('about.government_websites_title', k);
  const holidayUrls = [
    'https://library.ncdd.gov.kh/',
    'https://www.ocm.gov.kh/',
    'https://www.nbc.gov.kh/'
  ].join('\n');
  const holidayIndex = holidayText.indexOf(holidayName);
  const holidayDescription = holidayIndex < 0
    ? escapeHtml(holidayText)
    : `${escapeHtml(holidayText.slice(0, holidayIndex))}<a href="https://www.ocm.gov.kh/" class="source-url-link" data-url-source="holiday">${escapeHtml(holidayName)}</a>${escapeHtml(holidayText.slice(holidayIndex + holidayName.length))}`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog-surface sources-dialog">
      <h2>${text('ui.calendar_sources.7f962e')}</h2>
      <div class="sources-content">
        <p class="sources-update">${text('ui.new_event_years_and_corrections_are_delivered_through_a.a6af2d')}</p>
        <p>${text('rules.source_summary')}</p>
        <p>${holidayDescription}</p>
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

  let childClose: (() => void) | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    childClose?.();
    childClose = undefined;
    hideModal(overlay);
    overlay.remove();
  };
  setupModal(overlay, close);
  overlay.querySelector('.sources-close')!.addEventListener('click', close);
  overlay.querySelector('[data-url-source="holiday"]')?.addEventListener('click', event => {
    event.preventDefault();
    childClose?.();
    childClose = showUrlDialog(holidayTitle, holidayUrls, k);
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  showModal(overlay, L.text('ui.calendar_sources.7f962e', k));
  return close;
}
