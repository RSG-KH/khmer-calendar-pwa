import { CalendarWords, L } from '../data/i18n';
import { calendarEngine } from '../domain/KhmerCalendar';
import { Zodiac, ZODIAC_SIGNS } from '../domain/Zodiac';
import { ganzhiAnimalLabel, type GanzhiColumn } from '../domain/Ganzhi';
import type { WesternZodiacColumn } from '../domain/WesternZodiac';
import { askAiButton, launchAiSearch } from './AskAi';
import { setupModal, showModal, hideModal } from './Modal';
import { escapeHtml } from './html';

export type AstrologyKind = 'big3' | 'ganzhi';
export interface AstrologyDate {
  year: number;
  month: number;
  day: number;
}

export interface AstrologyDetails {
  kind: AstrologyKind;
  khmer: boolean;
  tableHtml: string;
  western: readonly WesternZodiacColumn[];
  ganzhi: readonly GanzhiColumn[];
  date?: AstrologyDate;
  time?: string | null;
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

const GANZHI_ROLES_EN: Record<string, string> = {
  year: 'Year',
  month: 'Month',
  day: 'Day',
  hour: 'Hour'
};

const GANZHI_ROLES_KM: Record<string, string> = {
  year: 'ឆ្នាំ',
  month: 'ខែ',
  day: 'ថ្ងៃ',
  hour: 'ម៉ោង'
};

const BIG3_LABELS_EN: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  rising: 'Rising'
};

const BIG3_LABELS_KM: Record<string, string> = {
  sun: 'ព្រះអាទិត្យ (Sun)',
  moon: 'ព្រះចន្ទ (Moon)',
  rising: 'រះ (Rising)'
};

function toKhmerDigits(value: string | number): string {
  const kmDigits = ['\u17E0', '\u17E1', '\u17E2', '\u17E3', '\u17E4', '\u17E5', '\u17E6', '\u17E7', '\u17E8', '\u17E9'];
  return String(value).replace(/\d/g, d => kmDigits[Number(d)]);
}

function formatKhmerGanzhiTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const hKm = CalendarWords.number(Number(hStr), true);
  const mKm = toKhmerDigits(mStr);
  return ` ម៉ោង ${hKm} និង ${mKm} នាទី`;
}

export function astrologySearchQuery(details: AstrologyDetails): string {
  const { khmer, kind, date, time } = details;

  if (kind === 'ganzhi') {
    const validPillars = details.ganzhi.filter(col => col.pillar !== null);
    let intro: string;
    if (khmer) {
      const datePart = date
        ? ` ដែលត្រូវនឹងថ្ងៃទី ${CalendarWords.number(date.day, true)} ${CalendarWords.month(date.month, true)} ឆ្នាំ ${CalendarWords.number(date.year, true)}${time ? formatKhmerGanzhiTime(time) : ''}`
        : '';
      intro = `ចូរពន្យល់អត្ថន័យតាមហោរាសាស្ត្រចិន(干支)${datePart}៖`;
    } else {
      const datePart = date
        ? ` for ${CalendarWords.month(date.month, false)} ${date.day}, ${date.year}${time ? `, at ${time}` : ''}`
        : '';
      intro = `Please explain the traditional astrological meanings of the Chinese Ganzhi (干支)${datePart}:`;
    }

    const lines = validPillars.map(({ key, pillar }, index) => {
      const isLast = index === validPillars.length - 1;
      if (khmer) {
        const label = GANZHI_ROLES_KM[key];
        const animal = ganzhiAnimalLabel(pillar!.branch, true, false);
        const clash = ganzhiAnimalLabel(pillar!.clashBranch, true, false);
        const end = isLast ? '។' : '';
        return `- ${label}៖ ${pillar!.nameZh} ${animal} (ឆុង៖ ${clash})${end}`;
      } else {
        const label = GANZHI_ROLES_EN[key];
        const animal = ganzhiAnimalLabel(pillar!.branch, false, false);
        const clash = ganzhiAnimalLabel(pillar!.clashBranch, false, false);
        const end = isLast ? '.' : ';';
        return `- ${label}: ${pillar!.nameZh} ${animal} (Clash: ${clash})${end}`;
      }
    });

    return lines.length > 0 ? `${intro}\n${lines.join('\n')}` : intro;
  }

  // kind === 'big3'
  const validSigns = details.western.filter(col => col.sign !== null);
  let intro: string;
  if (khmer) {
    const datePart = date
      ? ` សម្រាប់ថ្ងៃទី ${CalendarWords.number(date.day, true)} ${CalendarWords.month(date.month, true)} ឆ្នាំ ${CalendarWords.number(date.year, true)}${time ? ` ម៉ោង ${toKhmerDigits(time)}` : ''}`
      : '';
    intro = `ចូរពន្យល់ពីអត្ថន័យតាមក្បួនហោរាសាស្ត្រលោកខាងលិច នៃធាតុសំខាន់ទាំង ៣ (Big 3)${datePart} (ទីតាំងមិនបានបញ្ជាក់)៖`;
  } else {
    const datePart = date
      ? ` for ${CalendarWords.month(date.month, false)} ${date.day}, ${date.year}${time ? `, at ${time}` : ''}`
      : '';
    intro = `Please explain the traditional astrological meanings of the Big 3 (Sun, Moon, and Rising)${datePart} (unspecified location):`;
  }

  const lines = validSigns.map(({ key, sign }, index) => {
    const isLast = index === validSigns.length - 1;
    if (khmer) {
      const label = BIG3_LABELS_KM[key];
      const end = isLast ? ' ។' : '';
      return `- ${label}៖ ${sign!.englishName}${end}`;
    } else {
      const label = BIG3_LABELS_EN[key];
      const end = isLast ? '.' : ';';
      return `- ${label}: ${sign!.englishName}${end}`;
    }
  });

  return lines.length > 0 ? `${intro}\n${lines.join('\n')}` : intro;
}

/** Keep horizontal/vertical scrolling separate from whole-table activation. */
export function bindAstrologyTable(element: HTMLElement, open: () => void): void {
  let startX = 0, startY = 0, moved = false, tracking = false;
  const release = () => { tracking = false; element.classList.remove('is-pressed'); };
  const activate = () => { release(); element.focus({ preventScroll: true }); open(); };
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    startX = event.clientX; startY = event.clientY; moved = false; tracking = true;
    element.classList.add('is-pressed');
  });
  element.addEventListener('pointermove', event => {
    if (tracking && Math.hypot(event.clientX - startX, event.clientY - startY) > 8) {
      moved = true;
      release();
    }
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', () => { moved = true; release(); });
  element.addEventListener('pointerleave', () => { if (tracking) { moved = true; release(); } });
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
    const attribution = L.text('astrology.engine_calculations', details.khmer, { version: calendarEngine.version });
    this.overlay.innerHTML = `<div class="modal-dialog-surface astrology-details-dialog">
      ${background ? `<span class="dialog-watermark-animal tinted-watermark" style="--watermark-image: url('${escapeHtml(background)}')" aria-hidden="true"></span>` : ''}
      <h2 class="astrology-details-title">${escapeHtml(title)}</h2>
      <div class="card-divider"></div>
      <div class="astrology-details-content">${details.tableHtml}${rows}<div class="astrology-engine-attribution">${escapeHtml(attribution)}</div></div>
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
