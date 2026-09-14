// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { Icons } from './Icons';
import { CalendarWords, L } from '../data/i18n';
import { Storage, CustomEvent } from '../data/Storage';
import { CalendarEvent } from '../data/EventRepository';
import { KhmerDateDetails } from '../domain/KhmerDateDetails';
import { Zodiac } from '../domain/Zodiac';
import { eventInstant, isSupportedDate, todayInZone } from '../domain/DateTime';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';
import { prefersNativeTimePicker } from './Platform';
import { setupTimeField } from './TimeField';

/* ==========================================================================
   1. MONTH / YEAR PICKER MODAL
   ========================================================================== */
export class MonthPickerModal {
  private overlay: HTMLElement;
  private onSelect: (year: number, month: number) => void;
  private currentYear: number = new Date().getFullYear();
  private currentMonth: number = new Date().getMonth() + 1;
  private isKhmer: boolean = true;
  private selectedYear: number = this.currentYear;

  constructor(onSelect: (year: number, month: number) => void, private mode: 'month' | 'year' = 'month') {
    this.onSelect = onSelect;
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.innerHTML = `
      <div class="modal-dialog-surface month-picker-dialog" style="max-width: 360px;">
        ${mode === 'year' ? `<div class="year-picker-title-row">
          <span class="year-picker-title"></span>
          <button class="btn-today-pill btn-this-year"></button>
        </div>` : ''}
        <div class="month-picker-header">
          <button class="arrow-btn btn-prev-year">${Icons.chevronLeft}</button>
          <input type="number" min="1800" max="2200" inputmode="numeric" enterkeyhint="done" class="year-display" style="width: 110px; border: 0; border-radius: 10px; background: var(--bg-surface-variant); text-align: center; font-size: calc(22px * var(--font-scale)); font-weight: 700; color: var(--text-primary);" />
          <button class="arrow-btn btn-next-year">${Icons.chevronRight}</button>
        </div>
        ${mode === 'month' ? '<div class="month-picker-grid"></div>' : '<p class="year-picker-range">1800–2200</p>'}
        <div class="month-picker-footer">
          ${mode === 'year' ? '<button class="btn-today-pill btn-close-modal"></button><button class="btn-today-pill btn-confirm-year" style="background: var(--accent); color: var(--on-accent);"></button>' : `<button class="btn-today-pill btn-close-modal" style="background: var(--accent); color: var(--on-accent); padding: 8px 20px; border-radius: 20px;">
            ${L.text('ui.close.7df7dc', true) || 'Close'}
          </button>`}
        </div>
      </div>
    `;

    this.overlay.querySelector('.btn-prev-year')!.addEventListener('click', () => {
      this.currentYear = Math.max(1800, this.currentYear - 1);
      this.render();
    });

    this.overlay.querySelector('.btn-next-year')!.addEventListener('click', () => {
      this.currentYear = Math.min(2200, this.currentYear + 1);
      this.render();
    });

    this.overlay.querySelector('.btn-close-modal')!.addEventListener('click', () => {
      this.close();
    });
    this.overlay.querySelector('.btn-confirm-year')?.addEventListener('click', () => this.confirmYear());
    this.overlay.querySelector('.btn-this-year')?.addEventListener('click', () => {
      const year = Number(todayInZone(Storage.getSettings().todayTimeZone).slice(0, 4));
      this.onSelect(year, this.currentMonth);
      this.close();
    });

    this.overlay.querySelector<HTMLInputElement>('.year-display')!.addEventListener('change', event => {
      if (this.mode === 'year') { this.updateYearValidity(); return; }
      const value = (event.target as HTMLInputElement).valueAsNumber;
      if (Number.isInteger(value)) this.currentYear = Math.min(2200, Math.max(1800, value));
      this.render();
    });
    this.overlay.querySelector<HTMLInputElement>('.year-display')!.addEventListener('input', event => {
      if (this.mode === 'year') { this.updateYearValidity(); return; }
      const value = (event.target as HTMLInputElement).valueAsNumber;
      if (Number.isInteger(value) && value >= 1800 && value <= 2200) {
        this.currentYear = value;
        this.render();
      }
    });
    this.overlay.querySelector<HTMLInputElement>('.year-display')!.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (this.mode === 'year') { this.confirmYear(); return; }
        // Commit the year and dismiss the keyboard without closing the picker.
        this.overlay.focus({ preventScroll: true });
      }
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
  }

  open(year: number, month: number, isKhmer: boolean) {
    this.currentYear = year;
    this.selectedYear = year;
    this.currentMonth = month;
    this.isKhmer = isKhmer;
    this.render();
    showModal(this.overlay, this.mode === 'year' ? L.text('ui.choose_year.0853a0', isKhmer) : isKhmer ? 'ជ្រើសរើសខែ' : 'Choose month');
  }

  close() {
    hideModal(this.overlay);
  }

  private updateYearValidity(): boolean {
    const input = this.overlay.querySelector<HTMLInputElement>('.year-display')!;
    const value = input.valueAsNumber;
    const valid = Number.isInteger(value) && value >= 1800 && value <= 2200;
    input.setAttribute('aria-invalid', String(!valid));
    this.overlay.querySelector<HTMLButtonElement>('.btn-confirm-year')!.disabled = !valid;
    this.overlay.querySelector<HTMLButtonElement>('.btn-prev-year')!.disabled = !valid || value === 1800;
    this.overlay.querySelector<HTMLButtonElement>('.btn-next-year')!.disabled = !valid || value === 2200;
    if (valid) this.currentYear = value;
    return valid;
  }

  private confirmYear() {
    if (!this.updateYearValidity()) return;
    this.onSelect(this.currentYear, this.currentMonth);
    this.close();
  }

  private render() {
    const yearDisplay = this.overlay.querySelector<HTMLInputElement>('.year-display')!;
    yearDisplay.value = String(this.currentYear);
    yearDisplay.setAttribute('aria-label', this.isKhmer ? 'ឆ្នាំ' : 'Year');
    const previous = this.overlay.querySelector<HTMLButtonElement>('.btn-prev-year')!;
    const next = this.overlay.querySelector<HTMLButtonElement>('.btn-next-year')!;
    previous.disabled = this.currentYear === 1800;
    next.disabled = this.currentYear === 2200;
    previous.setAttribute('aria-label', this.isKhmer ? 'ឆ្នាំមុន' : 'Previous year');
    next.setAttribute('aria-label', this.isKhmer ? 'ឆ្នាំបន្ទាប់' : 'Next year');
    if (this.mode === 'year') {
      this.overlay.querySelector('.year-picker-title')!.textContent = L.text('ui.choose_year.0853a0', this.isKhmer);
      this.overlay.querySelector('.btn-this-year')!.textContent = L.text('ui.this_year.02e981', this.isKhmer);
      this.overlay.querySelector('.btn-close-modal')!.textContent = L.text('ui.cancel.5bf834', this.isKhmer);
      this.overlay.querySelector('.btn-confirm-year')!.textContent = L.text('ui.go.ba4f19', this.isKhmer);
      this.updateYearValidity();
      return;
    }
    this.overlay.querySelector('.btn-close-modal')!.textContent = L.text('ui.close.7df7dc', this.isKhmer);

    const grid = this.overlay.querySelector('.month-picker-grid')!;

    for (let m = 1; m <= 12; m++) {
      const existing = grid.children[m - 1] as HTMLButtonElement | undefined;
      const btn = existing || document.createElement('button');
      const selected = m === this.currentMonth && this.currentYear === this.selectedYear;
      btn.className = 'month-picker-cell' + (selected ? ' active' : '');
      btn.setAttribute('aria-pressed', String(selected));
      btn.textContent = CalendarWords.month(m, this.isKhmer, true);
      if (!existing) {
        btn.addEventListener('click', () => {
          this.onSelect(this.currentYear, m);
          this.close();
        });
        grid.appendChild(btn);
      }
    }
  }
}

/* ==========================================================================
   2. DATE DETAILS DIALOG MODAL (matching DateDetailsDialog in CalendarApp.kt)
   ========================================================================== */
export class DateDetailsDialogModal {
  private overlay: HTMLElement;
  private onOpenEvent: (event: CalendarEvent) => void;
  private onAddEvent: (dateStr: string) => void;

  constructor(onOpenEvent: (event: CalendarEvent) => void, onAddEvent: (dateStr: string) => void) {
    this.onOpenEvent = onOpenEvent;
    this.onAddEvent = onAddEvent;

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(dateStr: string, events: CalendarEvent[], isKhmer: boolean) {
    const parts = dateStr.split('-').map(Number);
    const info = KhmerDateDetails.fromGregorian(parts[0], parts[1], parts[2]);
    const todayStr = todayInZone(Storage.getSettings().todayTimeZone);
    const isToday = dateStr === todayStr;

    const animalImg = Zodiac.getAnimalDrawable(info.animalYear, true);
    const westernImg = Zodiac.getWesternDrawable(info.zodiac);

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface date-details-dialog" style="position: relative; overflow: hidden; max-width: 480px; width: 92%;">
        <!-- Watermarks -->
        <span class="dialog-watermark-animal tinted-watermark" style="--watermark-image: url('${animalImg}')" aria-hidden="true"></span>
        <span class="dialog-watermark-western tinted-watermark" style="--watermark-image: url('${westernImg}')" aria-hidden="true"></span>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; z-index: 1;">
          <span style="font-size: calc(16px * var(--font-scale)); font-weight: 600; color: var(--text-primary);">
            ${L.text('ui.date_details.e26d78', isKhmer)}
          </span>
          ${isToday ? `<span style="font-size: calc(12px * var(--font-scale)); font-weight: 600; color: var(--accent);">${L.text('ui.today.d71ac6', isKhmer)}</span>` : ''}
        </div>

        <div class="card-divider" style="margin: 0 0 16px 0;"></div>

        <div class="date-details-content" style="position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto;">
          <!-- Full Khmer Date -->
          <div class="full-lunar-date" style="font-size: calc(17px * var(--font-scale)); line-height: 1.8; color: var(--text-primary);">${isKhmer ? CalendarWords.fullKhmerDate(info) : CalendarWords.fullEnglishDate(info)}</div>

          <!-- Holy Day or Shaving Day label -->
          ${info.lunar.isHolyDay ? `
            <div style="font-size: calc(15px * var(--font-scale)); font-weight: 500; color: var(--secondary); display: flex; align-items: center; gap: 8px;">
              <img src="${import.meta.env.BASE_URL}assets/drawables/holy_day_lotus.png" style="width: 22px; height: 22px; object-fit: contain;" alt="" />
              ${L.text('ui.thngai_sil_buddhist_holy_day.89de73', isKhmer)}
            </div>
          ` : (info.lunar.isShavingDay ? `
            <div style="font-size: calc(15px * var(--font-scale)); font-weight: 500; color: var(--secondary);">
              ${L.text('ui.thngai_kaor_before_a_holy_day.d02977', isKhmer)}
            </div>
          ` : '')}

          <!-- Gregorian Date & Western Zodiac -->
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="font-size: calc(15px * var(--font-scale)); color: var(--on-surface-variant);">
              ${CalendarWords.month(info.month, false)} ${info.day}, ${info.year}
            </div>
            <div style="font-size: calc(14px * var(--font-scale)); font-weight: 500; color: var(--accent);">
              ${Zodiac.label(info.zodiac, false)}
            </div>
          </div>

          <!-- Events on this day -->
          ${events.length > 0 ? `
            <div class="card-divider" style="margin: 4px 0;"></div>
            <div style="font-size: calc(13px * var(--font-scale)); font-weight: 600; color: var(--on-surface-variant); margin-bottom: 2px;">
              ${L.text('ui.events_on_the_day.a174fc', isKhmer)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${events.map(e => `
                <button class="dialog-event-item" data-ev-id="${escapeHtml(e.id)}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--bg-surface-variant) 50%, transparent); cursor: pointer;">
                  <span class="mark-shape ${e.kind.toLowerCase()}"></span>
                  <div style="flex: 1; display: flex; flex-direction: column;">
                    <span style="font-size: calc(14px * var(--font-scale)); font-weight: 500; color: var(--text-primary);">${escapeHtml(isKhmer ? e.titleKm : e.titleEn)}</span>
                    <span style="font-size: calc(11px * var(--font-scale)); color: var(--on-surface-variant);">${L.text(e.kind === 'HOLIDAY' ? 'ui.holiday.253332' : e.kind === 'HOLY_DAY' ? 'ui.holy_day.28786d' : e.kind === 'CUSTOM' ? 'ui.custom.917053' : 'ui.observance.5b9a87', isKhmer)}${e.time ? ' · ' + escapeHtml(e.time) : ''}</span>
                  </div>
                  <span style="font-size: calc(18px * var(--font-scale)); color: var(--on-surface-variant);">›</span>
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; position: relative; z-index: 1;">
          <button class="btn-today-pill btn-dialog-add" style="border: 1px solid var(--outline); background: transparent; color: var(--text-primary);">
            + ${L.text('ui.add_event.bf2f10', isKhmer)}
          </button>
          <button class="btn-today-pill btn-dialog-close" style="background: var(--accent); color: var(--on-accent); padding: 8px 20px; border-radius: 20px;">
            ${L.text('ui.close.7df7dc', isKhmer)}
          </button>
        </div>
      </div>
    `;

    this.overlay.querySelector('.btn-dialog-close')!.addEventListener('click', () => this.close());
    this.overlay.querySelector('.btn-dialog-add')!.addEventListener('click', () => {
      this.close();
      this.onAddEvent(dateStr);
    });

    this.overlay.querySelectorAll('.dialog-event-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.evId;
        const ev = events.find(e => e.id === id);
        if (ev) {
          this.close();
          this.onOpenEvent(ev);
        }
      });
    });

    showModal(this.overlay, L.text('ui.date_details.e26d78', isKhmer));
  }

  close() {
    hideModal(this.overlay);
  }
}

/* ==========================================================================
   3. EVENT DETAILS DIALOG MODAL (matching EventDialog in CalendarApp.kt)
   ========================================================================== */
export class EventDetailsDialogModal {
  private overlay: HTMLElement;
  private onEdit: (event: CalendarEvent) => void;
  private onDelete: (id: string) => void;

  constructor(onEdit: (event: CalendarEvent) => void, onDelete: (id: string) => void) {
    this.onEdit = onEdit;
    this.onDelete = onDelete;

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(event: CalendarEvent, isKhmer: boolean) {
    const parts = event.date.split('-').map(Number);
    const info = KhmerDateDetails.fromGregorian(parts[0], parts[1], parts[2]);
    const isCustom = event.kind === 'CUSTOM';
    const animalImg = Zodiac.getAnimalDrawable(info.animalYear, true);
    const westernImg = Zodiac.getWesternDrawable(info.zodiac);

    let categoryDesc = '';
    if (isCustom) {
      categoryDesc = L.text('ui.a_custom_event_saved_on_your_device.96d6e7', isKhmer);
    } else if (event.kind === 'HOLY_DAY') {
      categoryDesc = L.text('ui.a_buddhist_observance_on_the_8th_and_15th_waxing_days_t.4bac2c', isKhmer);
    } else if (event.officialSourceUrl) {
      categoryDesc = L.text('ui.listed_in_cambodia_s_official_year_holiday_calendar.044398', isKhmer, { year: CalendarWords.number(parts[0], isKhmer) });
    }

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface" style="position: relative; overflow: hidden; max-width: 480px; width: 92%;">
        <span class="dialog-watermark-animal tinted-watermark" style="--watermark-image: url('${animalImg}')" aria-hidden="true"></span>
        <span class="dialog-watermark-western tinted-watermark" style="--watermark-image: url('${westernImg}')" aria-hidden="true"></span>

        <div style="position: relative; z-index: 1;">
          <div style="font-size: calc(18px * var(--font-scale)); font-weight: 600; color: var(--text-primary); line-height: 1.4; margin-bottom: 12px;">
            ${escapeHtml(isKhmer ? event.titleKm : event.titleEn)}
          </div>

          <div class="card-divider" style="margin: 0 0 14px 0;"></div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: calc(14px * var(--font-scale));">
            <!-- Date & Time -->
            <div style="font-weight: 500; color: var(--text-primary);">
              ${CalendarWords.month(parts[1], isKhmer)} ${CalendarWords.number(parts[2], isKhmer)}, ${CalendarWords.number(parts[0], isKhmer)}
              ${event.time ? ` · ${escapeHtml(event.time)}` : ''}
            </div>

            <!-- Notes if any -->
            ${event.notes ? `<div style="white-space: pre-wrap; overflow-wrap: anywhere; color: var(--on-surface-variant); background: var(--bg-surface-variant); padding: 10px; border-radius: 8px;">${escapeHtml(event.notes)}</div>` : ''}

            <!-- Lunar info -->
            <div style="color: var(--on-surface-variant);">
              ${CalendarWords.lunarFull(info.lunar.day, info.lunar.waxing, info.lunar.month, isKhmer)}
            </div>
            <div style="color: var(--on-surface-variant); font-size: calc(13px * var(--font-scale));">
              ${L.text('ui.buddhist_era.ea617c', isKhmer)} ${CalendarWords.number(info.lunar.buddhistYear, isKhmer)}
            </div>

            <div class="card-divider" style="margin: 4px 0;"></div>

            <!-- Category & Description -->
            <div style="font-weight: 600; color: var(--accent);">
              ${event.kind === 'HOLIDAY' ? L.text('ui.holiday.253332', isKhmer) :
                event.kind === 'HOLY_DAY' ? L.text('ui.holy_day.28786d', isKhmer) :
                event.kind === 'OBSERVANCE' ? L.text('ui.observance.5b9a87', isKhmer) :
                L.text('ui.custom.917053', isKhmer)}
            </div>
            ${categoryDesc ? `<div style="font-size: calc(13px * var(--font-scale)); line-height: 1.6; color: var(--on-surface-variant);">${categoryDesc}</div>` : ''}

            <!-- Secondary title -->
            <div style="font-size: calc(13px * var(--font-scale)); color: var(--on-surface-variant);">
              ${escapeHtml(isKhmer ? event.titleEn : event.titleKm)}
            </div>
          </div>

          ${isCustom ? `<div class="event-delete-confirmation" hidden>
            <p class="form-error" role="alert">${L.text('ui.delete_this_event.925263', isKhmer)}</p>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
              <button class="btn-today-pill btn-cancel-delete">${L.text('ui.cancel.5bf834', isKhmer)}</button>
              <button class="btn-today-pill btn-confirm-delete" style="color: var(--tertiary);">${L.text('ui.delete.4708f4', isKhmer)}</button>
            </div>
          </div>` : ''}
          <div class="event-detail-actions" style="display: flex; justify-content: ${isCustom ? 'space-between' : 'flex-end'}; align-items: center; margin-top: 24px;">
            ${isCustom ? `
              <button class="btn-today-pill btn-ev-delete" style="color: #FF5252; background: transparent; border: 1px solid #FF5252;">
                ${L.text('ui.delete.4708f4', isKhmer)}
              </button>
              <div style="display: flex; gap: 8px;">
                <button class="btn-today-pill btn-ev-edit" style="border: 1px solid var(--outline); background: transparent;">
                  ${L.text('ui.edit.bbdcac', isKhmer)}
                </button>
                <button class="btn-today-pill btn-ev-close" style="background: var(--accent); color: var(--on-accent); padding: 8px 18px; border-radius: 20px;">
                  ${L.text('ui.close.7df7dc', isKhmer)}
                </button>
              </div>
            ` : `
              <button class="btn-today-pill btn-ev-close" style="background: var(--accent); color: var(--on-accent); padding: 8px 20px; border-radius: 20px;">
                ${L.text('ui.close.7df7dc', isKhmer)}
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    this.overlay.querySelector('.btn-ev-close')!.addEventListener('click', () => this.close());

    if (isCustom) {
      this.overlay.querySelector('.btn-ev-edit')?.addEventListener('click', () => {
        this.close();
        this.onEdit(event);
      });

      this.overlay.querySelector('.btn-ev-delete')?.addEventListener('click', () => {
        this.overlay.querySelector<HTMLElement>('.event-delete-confirmation')!.hidden = false;
        this.overlay.querySelector<HTMLElement>('.event-detail-actions')!.hidden = true;
        this.overlay.querySelector<HTMLElement>('.btn-cancel-delete')!.focus();
      });
      this.overlay.querySelector('.btn-cancel-delete')?.addEventListener('click', () => {
        this.overlay.querySelector<HTMLElement>('.event-delete-confirmation')!.hidden = true;
        this.overlay.querySelector<HTMLElement>('.event-detail-actions')!.hidden = false;
        this.overlay.querySelector<HTMLElement>('.btn-ev-delete')!.focus();
      });
      this.overlay.querySelector('.btn-confirm-delete')?.addEventListener('click', () => {
        try {
          this.onDelete(event.id);
          this.close();
        } catch {
          this.overlay.querySelector('.form-error')!.textContent = L.text('ui.could_not_save_changes_please_try_again.140b3e', isKhmer);
        }
      });
    }

    showModal(this.overlay, isKhmer ? event.titleKm : event.titleEn);
  }

  close() {
    hideModal(this.overlay);
  }
}

/* ==========================================================================
   4. CUSTOM EVENT EDITOR MODAL (matching CustomEventEditor.kt)
   ========================================================================== */
export class CustomEventModal {
  private overlay: HTMLElement;
  private onSaved: (event: CustomEvent) => void;
  private cleanupTimeField?: () => void;

  constructor(onSaved: (event: CustomEvent) => void) {
    this.onSaved = onSaved;

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(dateStr: string, isKhmer: boolean, existing?: { id: string; title: string; date: string; time?: string; notes?: string; instant?: string }) {
    this.cleanupTimeField?.();
    this.cleanupTimeField = undefined;
    const isEdit = !!existing;
    const initialTitle = existing?.title || '';
    const initialDate = existing?.date || dateStr;
    const initialTime = existing ? existing.time || '' : '09:00';
    const initialNotes = existing?.notes || '';
    const zone = Storage.getSettings().todayTimeZone;
    const nativeTimePicker = prefersNativeTimePicker();

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface ${nativeTimePicker ? '' : 'custom-time-editor'}" style="max-width: 440px; width: 92%;">
        <div style="font-size: calc(18px * var(--font-scale)); font-weight: 600; color: var(--text-primary); margin-bottom: 16px;">
          ${isEdit ? L.text('ui.edit_event.c29d7a', isKhmer) : L.text('ui.add_event.bf2f10', isKhmer)}
        </div>

        <form id="custom-event-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label for="ev-title" style="display: block; font-size: calc(13px * var(--font-scale)); font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
              ${L.text('ui.title.a4c172', isKhmer)} *
            </label>
            <input type="text" id="ev-title" required maxlength="120" value="${escapeHtml(initialTitle)}"
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: calc(14px * var(--font-scale)); box-sizing: border-box;" />
          </div>

          <div class="event-datetime-fields">
            <div>
              <label for="ev-date" style="display: block; font-size: calc(13px * var(--font-scale)); font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
                ${L.text('ui.date_yyyy_mm_dd.fb201f', isKhmer)}
              </label>
              <div class="event-native-field">
                <input type="date" id="ev-date" required min="1800-01-01" max="2200-12-31" value="${escapeHtml(initialDate)}" />
              </div>
            </div>

            <div>
              <label id="ev-time-label" for="${nativeTimePicker ? 'ev-time' : 'ev-hour'}" style="display: block; font-size: calc(13px * var(--font-scale)); font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
                ${L.text('ui.time_hh_mm.8cf351', isKhmer)}
              </label>
              ${nativeTimePicker ? `<div class="event-native-field">
                <input type="time" id="ev-time" step="60" value="${escapeHtml(initialTime)}" />
              </div>` : `<input type="hidden" id="ev-time" value="${escapeHtml(initialTime)}" />
              <div class="custom-time-field" role="group" aria-labelledby="ev-time-label"></div>`}
            </div>
          </div>

          <div>
            <label for="ev-notes" style="display: block; font-size: calc(13px * var(--font-scale)); font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
              ${L.text('ui.notes_optional.fde199', isKhmer)}
            </label>
            <textarea id="ev-notes" rows="3" maxlength="2000"
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: calc(14px * var(--font-scale)); box-sizing: border-box; resize: vertical;">${escapeHtml(initialNotes)}</textarea>
          </div>

          <p class="settings-subtitle">${L.text('ui.date_and_time_follow_zone_switch_between_local_and_camb.e2a176', isKhmer, { zone: L.text(zone === 'local' ? 'ui.local_time.541b44' : 'ui.cambodia_utc_7.458037', isKhmer) })}</p>
          <p class="form-error" role="alert"></p>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
            <button type="button" class="btn-today-pill btn-form-cancel" style="border: 1px solid var(--outline); background: transparent;">
              ${L.text('ui.cancel.5bf834', isKhmer)}
            </button>
            <button type="submit" class="btn-today-pill btn-form-save" style="background: var(--accent); color: var(--on-accent); padding: 8px 22px; border-radius: 20px;">
              ${L.text('ui.save.1b0623', isKhmer)}
            </button>
          </div>
        </form>
      </div>
    `;

    this.overlay.querySelector('.btn-form-cancel')!.addEventListener('click', () => this.close());

    const form = this.overlay.querySelector('#custom-event-form') as HTMLFormElement;
    if (!nativeTimePicker) {
      this.cleanupTimeField = setupTimeField(
        form.querySelector('.custom-time-field')!, form.querySelector<HTMLInputElement>('#ev-time')!, isKhmer
      );
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = (this.overlay.querySelector('#ev-title') as HTMLInputElement).value.trim();
      const date = (this.overlay.querySelector('#ev-date') as HTMLInputElement).value;
      const time = (this.overlay.querySelector('#ev-time') as HTMLInputElement).value;
      const notes = (this.overlay.querySelector('#ev-notes') as HTMLTextAreaElement).value.trim();

      if (!title || !isSupportedDate(date)) return;
      const instant = time ? eventInstant(date, time, zone) : undefined;
      const error = this.overlay.querySelector('.form-error')!;
      if (time && !instant) {
        error.textContent = L.text('ui.this_time_does_not_exist_because_the_local_clock_change.49ab61', isKhmer);
        return;
      }

      const event: CustomEvent = {
        id: existing?.id || ('custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        title,
        date,
        time: time || undefined,
        notes: notes || undefined,
        instant: existing?.instant && date === initialDate && time === initialTime ? existing.instant : instant
      };

      try { Storage.saveCustomEventSync(event); }
      catch {
        error.textContent = L.text('ui.could_not_save_changes_please_try_again.140b3e', isKhmer);
        return;
      }
      this.close();
      this.onSaved(event);
    });

    showModal(this.overlay, L.text(isEdit ? 'ui.edit_event.c29d7a' : 'ui.add_event.bf2f10', isKhmer));
  }

  close() {
    this.cleanupTimeField?.();
    this.cleanupTimeField = undefined;
    hideModal(this.overlay);
  }
}
