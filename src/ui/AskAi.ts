import { L } from '../data/i18n';
import { Icons } from './Icons';
import { escapeHtml } from './html';

export function askAiButton(khmer: boolean): string {
  return `<button type="button" class="btn-today-pill btn-search-online btn-ask-ai" style="border: 1px solid var(--outline); background: transparent; color: var(--text-primary);">
    <span class="btn-icon" aria-hidden="true">${Icons.search}</span>
    ${escapeHtml(L.text('ui.ask_ai', khmer))}
    <span class="btn-icon" role="img" aria-label="${escapeHtml(L.text('ui.opens_in_external_browser', khmer))}">${Icons.openInNew}</span>
  </button>`;
}

export function launchAiSearch(query: string | null, khmer: boolean): void {
  if (!query) return;
  const url = `https://www.google.com/search?${new URLSearchParams({ q: query, hl: khmer ? 'km' : 'en', udm: '50' })}`;
  // The noopener feature returns null even on success; preserve blocked-popup feedback.
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  else window.alert(L.text('ui.no_browser_or_search_app', khmer));
}
