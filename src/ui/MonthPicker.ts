import { Icons } from './Icons';
import { CalendarWords, L } from '../data/i18n';
import { Storage } from '../data/Storage';
import { todayInZone } from '../domain/DateTime';
import { setupModal, showModal, hideModal } from './Modal';

/** Draft values never navigate until confirmed (except the Events shortcut). */
export class MonthPickerDraft {
  yearText = '';
  month = 1;
  reset(year: number, month: number) { this.yearText = String(year); this.month = month; }
  get year() { return Number(this.yearText); }
  get valid() { return /^\d{4}$/.test(this.yearText) && this.year >= 1800 && this.year <= 2200; }
  thisYear(today: string) { this.yearText = today.slice(0, 4); }
  shiftYear(direction: number) {
    if (this.valid) this.yearText = String(Math.min(2200, Math.max(1800, this.year + direction)));
  }
}

export class MonthPickerModal {
  private overlay = document.createElement('div');
  private draft = new MonthPickerDraft();
  private isKhmer = true;

  constructor(private onSelect: (year: number, month: number) => void, private mode: 'month' | 'year' = 'month') {
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.innerHTML = `
      <div class="modal-dialog-surface month-picker-dialog" style="max-width: 360px;">
        <div class="year-picker-title-row">
          <span class="year-picker-title"></span>
          <button class="btn-today-pill btn-this-year"></button>
        </div>
        <label class="year-picker-range" for="${mode}-picker-year"></label>
        <div class="month-picker-header">
          <button class="arrow-btn btn-prev-year">${Icons.chevronLeft}</button>
          <input id="${mode}-picker-year" type="number" min="1800" max="2200" inputmode="numeric" enterkeyhint="done" class="year-display" />
          <button class="arrow-btn btn-next-year">${Icons.chevronRight}</button>
        </div>
        ${mode === 'month' ? '<div class="month-picker-grid"></div>' : ''}
        <div class="month-picker-footer">
          <button class="btn-today-pill btn-close-modal"></button>
          <button class="btn-today-pill btn-confirm-year" style="background: var(--accent); color: var(--on-accent);"></button>
        </div>
      </div>`;
    const bind = (selector: string, action: () => void) => this.overlay.querySelector(selector)!.addEventListener('click', action);
    bind('.btn-prev-year', () => { this.draft.shiftYear(-1); this.render(); });
    bind('.btn-next-year', () => { this.draft.shiftYear(1); this.render(); });
    bind('.btn-close-modal', () => this.close());
    bind('.btn-confirm-year', () => this.confirm());
    bind('.btn-this-year', () => {
      this.draft.thisYear(todayInZone(Storage.getSettings().todayTimeZone));
      if (this.mode === 'year') this.confirm();
      else this.render();
    });
    const input = this.overlay.querySelector<HTMLInputElement>('.year-display')!;
    input.addEventListener('input', () => {
      this.draft.yearText = input.value;
      this.updateValidity();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); this.confirm(); }
    });
    this.overlay.addEventListener('click', event => { if (event.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(year: number, month: number, isKhmer: boolean) {
    this.draft.reset(year, month);
    this.isKhmer = isKhmer;
    this.render();
    showModal(this.overlay, this.title());
  }

  close() { hideModal(this.overlay); }

  private title() {
    return L.text(this.mode === 'month' ? 'ui.jump_to_month.b37571' : 'ui.choose_year.0853a0', this.isKhmer);
  }

  private confirm() {
    if (!this.draft.valid) return;
    this.onSelect(this.draft.year, this.draft.month);
    this.close();
  }

  private updateValidity() {
    const valid = this.draft.valid;
    this.overlay.querySelector('.year-display')!.setAttribute('aria-invalid', String(!valid));
    this.overlay.querySelector<HTMLButtonElement>('.btn-confirm-year')!.disabled = !valid;
    this.overlay.querySelector<HTMLButtonElement>('.btn-prev-year')!.disabled = !valid || this.draft.year === 1800;
    this.overlay.querySelector<HTMLButtonElement>('.btn-next-year')!.disabled = !valid || this.draft.year === 2200;
  }

  private render() {
    const text = (key: string) => L.text(key, this.isKhmer);
    const input = this.overlay.querySelector<HTMLInputElement>('.year-display')!;
    input.value = this.draft.yearText;
    this.overlay.querySelector('.year-picker-title')!.textContent = this.title();
    this.overlay.querySelector('.year-picker-range')!.textContent = `${text('ui.year.61d597')} (1800–2200)`;
    this.overlay.querySelector('.btn-this-year')!.textContent = text('ui.this_year.02e981');
    this.overlay.querySelector('.btn-close-modal')!.textContent = text('ui.cancel.5bf834');
    this.overlay.querySelector('.btn-confirm-year')!.textContent = text('ui.go.ba4f19');
    this.overlay.querySelector('.btn-prev-year')!.setAttribute('aria-label', text('ui.previous_year.a0618a'));
    this.overlay.querySelector('.btn-next-year')!.setAttribute('aria-label', text('ui.next_year.1f632d'));
    this.updateValidity();
    const grid = this.overlay.querySelector('.month-picker-grid');
    if (!grid) return;
    for (let month = 1; month <= 12; month++) {
      const existing = grid.children[month - 1] as HTMLButtonElement | undefined;
      const button = existing ?? document.createElement('button');
      const selected = month === this.draft.month;
      button.className = 'month-picker-cell' + (selected ? ' active' : '');
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = CalendarWords.month(month, this.isKhmer, true);
      if (!existing) {
        button.addEventListener('click', () => { this.draft.month = month; this.render(); });
        grid.appendChild(button);
      }
    }
  }
}
