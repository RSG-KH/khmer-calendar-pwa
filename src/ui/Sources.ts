import { L } from '../data/i18n';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';
import { copyText } from './Clipboard';
import appLicense from '../../LICENSE?raw';
// Bundled copies live in src/legal so Vite never imports out of the public directory;
// a test keeps them byte-identical to the served files in public/.
import attributionNotice from '../legal/NOTICE.txt?raw';
import fontLicense from '../legal/OFL.txt?raw';
import engineLicense from '../legal/engine-LICENSE.txt?raw';
import engineNotice from '../legal/engine-NOTICE.txt?raw';

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
      <p class="source-url-copy-status" role="status" aria-atomic="true" hidden></p>
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
  const copyButton = overlay.querySelector<HTMLButtonElement>('.source-url-copy')!;
  const copyStatus = overlay.querySelector<HTMLElement>('.source-url-copy-status')!;
  let copying = false;
  copyButton.addEventListener('click', async () => {
    if (closed || copying) return;
    copying = true;
    copyStatus.hidden = true;
    copyStatus.textContent = '';
    copyButton.setAttribute('aria-busy', 'true');
    try {
      await copyText(urlText, copyButton);
      if (!closed) close();
    } catch {
      if (closed) return;
      copyStatus.textContent = L.text('ui.could_not_copy_urls', k);
      copyStatus.hidden = false;
    } finally {
      copying = false;
      if (!closed) copyButton.removeAttribute('aria-busy');
    }
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  showModal(overlay, title);
  return close;
}

export function showCalendarSources(k: boolean): () => void {
  const text = (key: string) => escapeHtml(L.text(key, k));
  const license = (title: string, content: string) => `<section class="source-license"><h3>${escapeHtml(title)}</h3><pre>${escapeHtml(content)}</pre></section>`;
  const engineDescription = text('about.calendar_engine').replace('Khmer Calendar Engine',
    '<a class="source-engine-link" href="https://github.com/RSG-KH/khmer-calendar-engine" target="_blank" rel="noopener noreferrer">Khmer Calendar Engine</a>');
  const sourceUrls = [
    'https://www.geonames.org/',
    'https://creativecommons.org/licenses/by/4.0/',
    'https://en.wikipedia.org/wiki/Provinces_of_Cambodia',
    'https://en.wikipedia.org/wiki/List_of_districts,_municipalities_and_sections_in_Cambodia',
    'https://en.wikipedia.org/wiki/List_of_communes_in_Cambodia',
    'https://openadmindata.org/api/kh/'
  ].join('\n');
  const sourceUrlsTitle = k ? 'អាសយដ្ឋានប្រភព' : 'Source URLs';
  const divisionDescription = k
    ? 'ទិន្នន័យបំណែងចែករដ្ឋបាលក្រៅប្រទេសកម្ពុជា គឺទទួលបានពី GeoNames ក្រោមអាជ្ញាប័ណ្ណ CC BY 4.0។ បញ្ជីឈ្មោះខេត្ត ស្រុក និងឃុំនៃប្រទេសកម្ពុជា ត្រូវបានដកស្រង់ចេញពី Wikipedia ដែលជាប្រភពយោងចម្បង ដោយរួមជាមួយនិងកំណត់ត្រាបន្ថែមមួយចំនួនពី CambodiaPostalCode។ ចំណែកកូអរដោនេផ្នែករដ្ឋបាលកម្ពុជាភាគច្រើន គឺទទួលបានពី Open Admin Data ក្រោមអាជ្ញាប័ណ្ណ CC BY 4.0។ រីឯកូអរដោនេបន្ថែម ត្រូវបានដកស្រង់ចេញពី OCHA / នាយកដ្ឋានភូមិសាស្ត្រ GeoNames OpenStreetMap និង Wikidata។'
    : 'Outside Cambodia, administrative divisions come from GeoNames under CC BY 4.0. In Cambodia, Wikipedia’s province, district, and commune lists are the main references, with some additional records from CambodiaPostalCode. Most Cambodian division coordinates come from Open Admin Data under CC BY 4.0; supplemental coordinates draw on OCHA / Department of Geography, GeoNames, OpenStreetMap, and Wikidata.';

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
    : `${escapeHtml(holidayText.slice(0, holidayIndex))}<button type="button" class="source-url-link" data-url-source="holiday">${escapeHtml(holidayName)}</button>${escapeHtml(holidayText.slice(holidayIndex + holidayName.length))}`;

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
        <div class="source-data-credits">
          <p>${escapeHtml(divisionDescription)} <button type="button" class="source-url-link" data-url-source="data">${k ? '<strong>មើល ប្រភព URL ទាំងអស់។</strong>' : 'View source URLs'}</button>${k ? '' : '.'}</p>
        </div>
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
  overlay.querySelector('[data-url-source="data"]')?.addEventListener('click', () => {
    childClose?.();
    childClose = showUrlDialog(sourceUrlsTitle, sourceUrls, k);
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  showModal(overlay, L.text('ui.calendar_sources.7f962e', k));
  return close;
}
