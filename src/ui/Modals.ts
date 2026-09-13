// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { Icons } from './Icons';
import { CalendarWords, L } from '../data/i18n';
import { Storage, CustomEvent } from '../data/Storage';
import { CalendarEvent } from '../data/EventRepository';
import { KhmerDateDetails } from '../domain/KhmerDateDetails';
import { Zodiac } from '../domain/Zodiac';

/* ==========================================================================
   1. MONTH PICKER MODAL (3x4 grid)
   ========================================================================== */
export class MonthPickerModal {
  private overlay: HTMLElement;
  private onSelect: (year: number, month: number) => void;
  private currentYear: number = new Date().getFullYear();
  private currentMonth: number = new Date().getMonth() + 1;
  private isKhmer: boolean = true;

  constructor(onSelect: (year: number, month: number) => void) {
    this.onSelect = onSelect;
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal-dialog-surface" style="max-width: 360px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <button class="arrow-btn btn-prev-year">${Icons.chevronLeft}</button>
          <span class="year-display" style="font-size: 22px; font-weight: 700; color: var(--text-primary);"></span>
          <button class="arrow-btn btn-next-year">${Icons.chevronRight}</button>
        </div>
        <div class="month-picker-grid"></div>
        <div style="display: flex; justify-content: flex-end; margin-top: 18px;">
          <button class="btn-today-pill btn-close-modal" style="background: var(--accent); color: var(--on-accent); padding: 8px 20px; border-radius: 20px;">
            ${L.text('ui.close.7df7dc', true) || 'Close'}
          </button>
        </div>
      </div>
    `;

    this.overlay.querySelector('.btn-prev-year')!.addEventListener('click', () => {
      this.currentYear--;
      this.render();
    });

    this.overlay.querySelector('.btn-next-year')!.addEventListener('click', () => {
      this.currentYear++;
      this.render();
    });

    this.overlay.querySelector('.btn-close-modal')!.addEventListener('click', () => {
      this.close();
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
  }

  open(year: number, month: number, isKhmer: boolean) {
    this.currentYear = year;
    this.currentMonth = month;
    this.isKhmer = isKhmer;
    this.render();
    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
  }

  private render() {
    const yearDisplay = this.overlay.querySelector('.year-display')!;
    yearDisplay.textContent = CalendarWords.number(this.currentYear, this.isKhmer);

    const grid = this.overlay.querySelector('.month-picker-grid')!;
    grid.innerHTML = '';

    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.className = 'month-picker-cell' + (m === this.currentMonth ? ' active' : '');
      btn.textContent = CalendarWords.month(m, this.isKhmer, true);
      btn.addEventListener('click', () => {
        this.onSelect(this.currentYear, m);
        this.close();
      });
      grid.appendChild(btn);
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
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(dateStr: string, events: CalendarEvent[], isKhmer: boolean) {
    const parts = dateStr.split('-').map(Number);
    const info = KhmerDateDetails.fromGregorian(parts[0], parts[1], parts[2]);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;

    const animalImg = Zodiac.getAnimalDrawable(info.animalYear, true);
    const westernImg = Zodiac.getWesternDrawable(info.zodiac);

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface" style="position: relative; overflow: hidden; max-width: 480px; width: 92%;">
        <!-- Watermarks -->
        <img src="${animalImg}" class="dialog-watermark-animal" alt="" />
        <img src="${westernImg}" class="dialog-watermark-western" alt="" />

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; z-index: 1;">
          <span style="font-size: 16px; font-weight: 600; color: var(--text-primary);">
            ${L.text('ui.date_details.e26d78', isKhmer)}
          </span>
          ${isToday ? `<span style="font-size: 12px; font-weight: 600; color: var(--accent);">${L.text('ui.today.d71ac6', isKhmer)}</span>` : ''}
        </div>

        <div class="card-divider" style="margin: 0 0 16px 0;"></div>

        <div style="position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto;">
          <!-- Full Khmer Date -->
          <div style="font-size: 17px; line-height: 1.8; color: var(--text-primary);">
            ${CalendarWords.fullKhmerDate(info)}
          </div>

          <!-- Holy Day or Shaving Day label -->
          ${info.lunar.isHolyDay ? `
            <div style="font-size: 15px; font-weight: 500; color: var(--secondary); display: flex; align-items: center; gap: 8px;">
              <img src="/assets/drawables/holy_day_lotus.png" style="width: 22px; height: 22px; object-fit: contain;" alt="" />
              ${L.text('ui.thngai_sil_buddhist_holy_day.89de73', isKhmer)}
            </div>
          ` : (info.lunar.isShavingDay ? `
            <div style="font-size: 15px; font-weight: 500; color: var(--secondary);">
              ${L.text('ui.thngai_kaor_before_a_holy_day.d02977', isKhmer)}
            </div>
          ` : '')}

          <!-- Gregorian Date & Western Zodiac -->
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="font-size: 15px; color: var(--on-surface-variant);">
              ${CalendarWords.month(info.month, isKhmer)} ${CalendarWords.number(info.day, isKhmer)}, ${CalendarWords.number(info.year, isKhmer)}
            </div>
            <div style="font-size: 14px; font-weight: 500; color: var(--accent);">
              ${Zodiac.label(info.zodiac, isKhmer)}
            </div>
          </div>

          <!-- Events on this day -->
          ${events.length > 0 ? `
            <div class="card-divider" style="margin: 4px 0;"></div>
            <div style="font-size: 13px; font-weight: 600; color: var(--on-surface-variant); margin-bottom: 2px;">
              ${L.text('ui.events_on_the_day.a174fc', isKhmer)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${events.map(e => `
                <div class="dialog-event-item" data-ev-id="${e.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--bg-surface-variant); cursor: pointer;">
                  <span class="mark-shape ${e.kind.toLowerCase()}"></span>
                  <div style="flex: 1; display: flex; flex-direction: column;">
                    <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">${isKhmer ? e.titleKm : e.titleEn}</span>
                    <span style="font-size: 11px; color: var(--on-surface-variant);">${e.kind}${e.time ? ' · ' + e.time : ''}</span>
                  </div>
                  <span style="font-size: 18px; color: var(--on-surface-variant);">›</span>
                </div>
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

    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
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
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(event: CalendarEvent, isKhmer: boolean) {
    const parts = event.date.split('-').map(Number);
    const info = KhmerDateDetails.fromGregorian(parts[0], parts[1], parts[2]);
    const isCustom = event.kind === 'CUSTOM';

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
        ${isCustom ? `<img src="/assets/drawables/custom_event_star.png" class="dialog-watermark-star" alt="" />` : ''}

        <div style="position: relative; z-index: 1;">
          <div style="font-size: 18px; font-weight: 600; color: var(--text-primary); line-height: 1.4; margin-bottom: 12px;">
            ${isKhmer ? event.titleKm : event.titleEn}
          </div>

          <div class="card-divider" style="margin: 0 0 14px 0;"></div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
            <!-- Date & Time -->
            <div style="font-weight: 500; color: var(--text-primary);">
              ${CalendarWords.month(parts[1], isKhmer)} ${CalendarWords.number(parts[2], isKhmer)}, ${CalendarWords.number(parts[0], isKhmer)}
              ${event.time ? ` · ${event.time}` : ''}
            </div>

            <!-- Notes if any -->
            ${event.notes ? `<div style="color: var(--on-surface-variant); background: var(--bg-surface-variant); padding: 10px; border-radius: 8px;">${event.notes}</div>` : ''}

            <!-- Lunar info -->
            <div style="color: var(--on-surface-variant);">
              ${CalendarWords.lunarFull(info.lunar.day, info.lunar.waxing, info.lunar.month, isKhmer)}
            </div>
            <div style="color: var(--on-surface-variant); font-size: 13px;">
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
            ${categoryDesc ? `<div style="font-size: 13px; line-height: 1.6; color: var(--on-surface-variant);">${categoryDesc}</div>` : ''}

            <!-- Secondary title -->
            <div style="font-size: 13px; color: var(--on-surface-variant);">
              ${isKhmer ? event.titleEn : event.titleKm}
            </div>
          </div>

          <div style="display: flex; justify-content: ${isCustom ? 'space-between' : 'flex-end'}; align-items: center; margin-top: 24px;">
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
        const confirmMsg = L.text('ui.delete_this_event.925263', isKhmer);
        if (confirm(confirmMsg)) {
          this.close();
          this.onDelete(event.id);
        }
      });
    }

    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
  }
}

/* ==========================================================================
   4. CUSTOM EVENT EDITOR MODAL (matching CustomEventEditor.kt)
   ========================================================================== */
export class CustomEventModal {
  private overlay: HTMLElement;
  private onSaved: () => void;

  constructor(onSaved: () => void) {
    this.onSaved = onSaved;

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(dateStr: string, isKhmer: boolean, existing?: { id: string; title: string; date: string; time?: string; notes?: string }) {
    const isEdit = !!existing;
    const initialTitle = existing?.title || '';
    const initialDate = existing?.date || dateStr;
    const initialTime = existing?.time || '09:00';
    const initialNotes = existing?.notes || '';

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface" style="max-width: 440px; width: 92%;">
        <div style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;">
          ${isEdit ? L.text('ui.edit_event.c29d7a', isKhmer) : L.text('ui.add_event.bf2f10', isKhmer)}
        </div>

        <form id="custom-event-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
              ${L.text('ui.title.a4c172', isKhmer)} *
            </label>
            <input type="text" id="ev-title" required value="${initialTitle}"
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box;" />
          </div>

          <div style="display: flex; gap: 10px;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
                ${L.text('ui.date_yyyy_mm_dd.fb201f', isKhmer)}
              </label>
              <input type="date" id="ev-date" required value="${initialDate}"
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box;" />
            </div>

            <div style="flex: 1;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
                ${L.text('ui.time_hh_mm.8cf351', isKhmer)}
              </label>
              <input type="time" id="ev-time" value="${initialTime}"
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
              ${L.text('ui.notes_optional.fde199', isKhmer)}
            </label>
            <textarea id="ev-notes" rows="3"
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box; resize: vertical;">${initialNotes}</textarea>
          </div>

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
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = (this.overlay.querySelector('#ev-title') as HTMLInputElement).value.trim();
      const date = (this.overlay.querySelector('#ev-date') as HTMLInputElement).value;
      const time = (this.overlay.querySelector('#ev-time') as HTMLInputElement).value;
      const notes = (this.overlay.querySelector('#ev-notes') as HTMLTextAreaElement).value.trim();

      if (!title || !date) return;

      const event: CustomEvent = {
        id: existing?.id || ('custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        title,
        date,
        time: time || undefined,
        notes: notes || undefined
      };

      Storage.saveCustomEventSync(event);
      this.close();
      this.onSaved();
    });

    this.overlay.classList.add('open');
  }

  close() {
    this.overlay.classList.remove('open');
  }
}
