import { L } from '../data/i18n';
import { Zodiac, ZODIAC_SIGNS } from '../domain/Zodiac';
import { ganzhiAnimalLabel, type GanzhiColumn } from '../domain/Ganzhi';
import type { WesternZodiacColumn } from '../domain/WesternZodiac';
import { askAiButton, launchAiSearch } from './AskAi';
import { setupModal, showModal, hideModal } from './Modal';
import { escapeHtml } from './html';

export type AstrologyKind = 'big3' | 'ganzhi';
export interface AstrologyDetails {
  kind: AstrologyKind;
  khmer: boolean;
  tableHtml: string;
  western: readonly WesternZodiacColumn[];
  ganzhi: readonly GanzhiColumn[];
}

export function astrologyTitle(kind: AstrologyKind, khmer: boolean): string {
  return L.text(kind === 'big3' ? 'ui.zodiac_big3_title' : 'ui.chinese_ganzhi_title', khmer);
}

const displaySign = (column?: WesternZodiacColumn) => column?.sign
  ? ZODIAC_SIGNS[column.sign.englishName.toUpperCase()] : undefined;

export function astrologyBackground(details: AstrologyDetails): string | undefined {
  if (details.kind === 'big3') {
    const sun = displaySign(details.western.find(column => column.key === 'sun'));
    return sun ? Zodiac.getWesternDrawable(sun) : undefined;
  }
  const year = details.ganzhi.find(column => column.key === 'year')?.pillar;
  return year ? Zodiac.getAnimalDrawable(year.branch.index, true) : undefined;
}

export function astrologySearchQuery(details: AstrologyDetails): string {
  const { khmer } = details;
  const values = details.kind === 'big3'
    ? details.western.flatMap(({ key, sign }) => sign
      ? [`${L.text(`ui.western_zodiac_${key}`, khmer)}: ${sign.englishName}`] : [])
    : details.ganzhi.flatMap(({ key, pillar }) => pillar
      ? [`${L.text(`ui.ganzhi_${key === 'day' || key === 'hour' ? `${key}_column` : key}`, khmer)}: `
        + `${pillar.nameZh} ${ganzhiAnimalLabel(pillar.branch, khmer, false)} `
        + `(${L.text('ui.ganzhi_clash', khmer)}: ${ganzhiAnimalLabel(pillar.clashBranch, khmer, false)})`] : []);
  return L.text('ui.astrology_ai_query', khmer, {
    details: `${astrologyTitle(details.kind, khmer)}: ${values.join('; ')}`
  });
}

/** Keep horizontal/vertical scrolling separate from whole-table activation. */
export function bindAstrologyTable(element: HTMLElement, open: () => void): void {
  let startX = 0, startY = 0, moved = false, tracking = false;
  const activate = () => { element.focus({ preventScroll: true }); open(); };
  element.addEventListener('pointerdown', event => {
    startX = event.clientX; startY = event.clientY; moved = false; tracking = true;
  });
  element.addEventListener('pointermove', event => {
    if (tracking && Math.hypot(event.clientX - startX, event.clientY - startY) > 8) moved = true;
  });
  element.addEventListener('pointerup', () => { tracking = false; });
  element.addEventListener('pointercancel', () => { tracking = false; moved = true; });
  element.addEventListener('click', event => {
    const wasDrag = moved;
    moved = false;
    if (event.detail !== 0 && wasDrag) { event.preventDefault(); return; }
    activate();
  });
  element.addEventListener('keydown', event => {
    if (event.target !== element || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (!event.repeat) activate();
  });
}

export class AstrologyDetailsModal {
  private overlay: HTMLElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay astrology-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.addEventListener('click', event => { if (event.target === this.overlay) this.close(); });
  }

  open(details: AstrologyDetails) {
    const title = astrologyTitle(details.kind, details.khmer);
    const background = astrologyBackground(details);
    const rows = details.kind === 'big3' ? `<div class="astrology-sign-details">${details.western.map(column => {
      const sign = displaySign(column);
      const label = sign ? Zodiac.label(sign, false) : '—';
      const role = L.text(`ui.western_zodiac_${column.key}`, details.khmer);
      return `<div class="astrology-sign-detail" data-sign="${column.key}" aria-label="${escapeHtml(`${role}: ${label}`)}">${escapeHtml(label)}</div>`;
    }).join('')}</div>` : '';
    this.overlay.innerHTML = `<div class="modal-dialog-surface astrology-details-dialog">
      ${background ? `<span class="dialog-watermark-animal tinted-watermark" style="--watermark-image: url('${escapeHtml(background)}')" aria-hidden="true"></span>` : ''}
      <h2 class="astrology-details-title">${escapeHtml(title)}</h2>
      <div class="card-divider"></div>
      <div class="astrology-details-content">${details.tableHtml}${rows}</div>
      <div class="astrology-details-actions">
        ${askAiButton(details.khmer)}
        <button type="button" class="btn-today-pill btn-astrology-close">${escapeHtml(L.text('ui.close.7df7dc', details.khmer))}</button>
      </div>
    </div>`;
    this.overlay.querySelector('.btn-ask-ai')!.addEventListener('click', () => launchAiSearch(astrologySearchQuery(details), details.khmer));
    this.overlay.querySelector('.btn-astrology-close')!.addEventListener('click', () => this.close());
    document.body.appendChild(this.overlay);
    showModal(this.overlay, title);
  }

  close() {
    hideModal(this.overlay);
    this.overlay.innerHTML = '';
  }

  dispose() {
    this.close();
    this.overlay.remove();
  }
}
