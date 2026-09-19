// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { Icons } from './Icons';
import { CalendarWords, L } from '../data/i18n';
import { Storage, CustomEvent } from '../data/Storage';
import { CalendarEvent } from '../data/EventRepository';
import { KhmerDateDetails } from '../domain/KhmerDateDetails';
import { Zodiac } from '../domain/Zodiac';
import { eventInstant, isSupportedDate, namedTimeZone, timeZoneOffsetLabel, todayInZone } from '../domain/DateTime';
import { escapeHtml } from './html';
import { setupModal, showModal, hideModal } from './Modal';
import { prefersNativeTimePicker } from './Platform';
import { setupTimeField } from './TimeField';
import { setupCopyButton } from './CopyButton';
import { holyDayLotus } from './HolyDayLotus';
import { EventRepeatField, repeatDateLabel } from './EventRepeatField';

/* ==========================================================================
   1. MONTH / YEAR PICKER MODAL
   ========================================================================== */
export { MonthPickerModal } from './MonthPicker';

/* ==========================================================================
   2. DATE DETAILS DIALOG MODAL (matching DateDetailsDialog in CalendarApp.kt)
   ========================================================================== */
export class DateDetailsDialogModal {
  private overlay: HTMLElement;
  private onOpenEvent: (event: CalendarEvent) => void;
  private onAddEvent: (dateStr: string) => void;
  private cleanupDateCopy?: () => void;

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
    this.cleanupDateCopy?.();
    const parts = dateStr.split('-').map(Number);
    const info = KhmerDateDetails.fromGregorian(parts[0], parts[1], parts[2]);
    const fullDate = isKhmer ? CalendarWords.fullKhmerDate(info) : CalendarWords.fullEnglishDate(info);
    const settings = Storage.getSettings();
    const todayStr = todayInZone(settings.todayTimeZone);
    const isToday = dateStr === todayStr;

    const animalImg = Zodiac.getAnimalDrawable(info.animalYear, true);
    const westernImg = Zodiac.getWesternDrawable(info.zodiac);
    const showHolyDay = settings.holyDayMarkers && (info.lunar.isHolyDay || info.lunar.isShavingDay);
    const showWesternZodiac = settings.showWesternZodiac;

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface date-details-dialog" style="position: relative; overflow: hidden; max-width: 480px; width: 92%;">
        <!-- Watermarks -->
        <span class="dialog-watermark-animal tinted-watermark" style="--watermark-image: url('${animalImg}')" aria-hidden="true"></span>
        ${showWesternZodiac ? `<span class="dialog-watermark-western tinted-watermark" style="--watermark-image: url('${westernImg}')" aria-hidden="true"></span>` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; z-index: 1;">
          <span style="font-size: calc(16px * var(--font-scale)); font-weight: 600; color: var(--text-primary);">
            ${L.text('ui.date_details.e26d78', isKhmer)}
          </span>
          ${isToday ? `<span style="font-size: calc(12px * var(--font-scale)); font-weight: 600; color: var(--accent);">${L.text('ui.today.d71ac6', isKhmer)}</span>` : ''}
        </div>

        <div class="card-divider" style="margin: 0 0 16px 0;"></div>

        <div class="date-details-content" style="position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto;">
          <!-- Gregorian Date -->
          <div style="font-size: calc(15px * var(--font-scale)); color: var(--on-surface-variant);">
            ${CalendarWords.month(info.month, false)} ${info.day}, ${info.year}
          </div>

          <!-- Full Khmer Date -->
          <div class="date-description">
            <div class="date-description-row">
              <div class="full-lunar-date">${escapeHtml(fullDate)}</div>
              <button type="button" class="btn-copy-text btn-copy-date" aria-label="${L.text('ui.copy_full_date', isKhmer)}">
                <span aria-hidden="true">${Icons.copy}</span>
              </button>
            </div>
            <p class="copy-status date-copy-status" role="status" aria-atomic="true"></p>
          </div>

          <!-- Holy Day & Western Zodiac -->
          ${showHolyDay || showWesternZodiac ? `
            <div class="card-divider" style="margin: 0;"></div>
            <div style="display: flex; flex-direction: column; gap: 9px;">
              ${showHolyDay ? `
                <div style="font-size: calc(14px * var(--font-scale)); font-weight: 500; color: var(--secondary); display: flex; align-items: center; gap: 8px;">
                  ${info.lunar.isHolyDay ? `
                    <img src="${holyDayLotus(info.lunar)}" style="width: 20px; height: 20px; object-fit: contain;" alt="" />
                    ${L.text('ui.thngai_sil_buddhist_holy_day.89de73', isKhmer)}
                  ` : `
                    <span style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: calc(16px * var(--font-scale)); line-height: 1;" aria-hidden="true">🙏</span>
                    ${L.text('ui.thngai_kaor_before_a_holy_day.d02977', isKhmer)}
                  `}
                </div>
              ` : ''}

              ${showWesternZodiac ? `
                <div style="font-size: calc(14px * var(--font-scale)); font-weight: 500; color: var(--accent); display: flex; align-items: center; gap: 8px;">
                  <span style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: calc(16px * var(--font-scale)); line-height: 1;" aria-hidden="true">${info.zodiac.symbol}</span>
                  <span>${Zodiac.labelWithoutSymbol(info.zodiac, false)}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Events on this day -->
          ${events.length > 0 ? `
            <div class="card-divider" style="margin: 0;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${events.map(e => `
                <button class="dialog-event-item" data-ev-id="${escapeHtml(e.id)}" style="display: flex; align-items: center; gap: 10px; padding: 6.5px 10px; border-radius: 10px; background: color-mix(in srgb, var(--bg-surface-variant) 50%, transparent); cursor: pointer;">
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

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 30px; position: relative; z-index: 1;">
          <button class="btn-today-pill btn-dialog-add" style="border: 1px solid var(--outline); background: transparent; color: var(--text-primary);">
            + ${L.text('ui.add_event.bf2f10', isKhmer)}
          </button>
          <button class="btn-today-pill btn-dialog-close" style="background: var(--accent); color: var(--on-accent); padding: 8px 20px; border-radius: 20px;">
            ${L.text('ui.close.7df7dc', isKhmer)}
          </button>
        </div>
      </div>
    `;

    this.cleanupDateCopy = setupCopyButton(
      this.overlay.querySelector<HTMLButtonElement>('.btn-copy-date')!,
      this.overlay.querySelector<HTMLElement>('.date-copy-status')!,
      fullDate,
      {
        copied: L.text('ui.full_date_copied', isKhmer),
        failed: L.text('ui.could_not_copy_date', isKhmer)
      }
    );

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
    this.cleanupDateCopy?.();
    this.cleanupDateCopy = undefined;
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
  private cleanupTitleCopy?: () => void;

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
    this.cleanupTitleCopy?.();
    const title = isKhmer ? event.titleKm : event.titleEn;
    const parts = event.date.split('-').map(Number);
    const info = KhmerDateDetails.fromGregorian(parts[0], parts[1], parts[2]);
    const isCustom = event.kind === 'CUSTOM';
    const settings = Storage.getSettings();
    const animalImg = Zodiac.getAnimalDrawable(info.animalYear, true);
    const westernImg = Zodiac.getWesternDrawable(info.zodiac);

    let categoryDesc = '';
    let isEngineCalculated = false;
    if (isCustom) {
      categoryDesc = L.text('ui.a_custom_event_saved_on_your_device.96d6e7', isKhmer);
    } else if (event.kind === 'HOLY_DAY') {
      categoryDesc = L.text('ui.a_buddhist_observance_on_the_8th_and_15th_waxing_days_t.4bac2c', isKhmer);
    } else if (event.kind === 'HOLIDAY') {
      categoryDesc = L.text('ui.listed_in_cambodia_s_official_year_holiday_calendar.044398', isKhmer, { year: CalendarWords.number(parts[0], isKhmer) });
    } else {
      categoryDesc = L.text('events.engine_calculations', isKhmer);
      isEngineCalculated = true;
    }

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface" style="position: relative; overflow: hidden; max-width: 480px; width: 92%;">
        <span class="dialog-watermark-animal tinted-watermark" style="--watermark-image: url('${animalImg}')" aria-hidden="true"></span>
        ${settings.showWesternZodiac ? `<span class="dialog-watermark-western tinted-watermark" style="--watermark-image: url('${westernImg}')" aria-hidden="true"></span>` : ''}

        <div style="position: relative; z-index: 1;">
          <div class="event-title-copy">
            <div class="event-title-row">
              <span class="event-detail-title">${escapeHtml(title)}</span><button type="button" class="btn-copy-text btn-copy-title" aria-label="${L.text('ui.copy_event_title', isKhmer)}">
                <span aria-hidden="true">${Icons.copy}</span>
              </button>
            </div>
            <p class="copy-status event-title-copy-status" role="status" aria-atomic="true"></p>
          </div>

          <div class="card-divider" style="margin: 0 0 14px 0;"></div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: calc(14px * var(--font-scale));">
            <!-- Date & Time -->
            <div style="font-weight: 500; color: var(--text-primary);">
              ${CalendarWords.date(parts[0], parts[1], parts[2], isKhmer)}${event.time ? ` · ${escapeHtml(event.time)}` : ''}
            </div>

            ${event.repeat ? `<p class="settings-subtitle">${L.text(`repeat.${event.repeat.frequency}`, isKhmer)} · ${L.text('repeat.end', isKhmer)} ${repeatDateLabel(event.repeat.until, isKhmer)}</p>` : ''}

            <!-- Notes if any -->
            ${event.notes ? `<div style="white-space: pre-wrap; overflow-wrap: anywhere; color: var(--on-surface-variant); background: var(--bg-surface-variant); padding: 10px; border-radius: 8px;">${escapeHtml(event.notes)}</div>` : ''}

            <!-- Lunar info -->
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="color: var(--on-surface-variant); line-height: 1.5;">${CalendarWords.lunarSummary(info, isKhmer)}</div>
              <div style="color: var(--on-surface-variant); font-size: calc(13px * var(--font-scale));">
                ${L.text('ui.buddhist_era.ea617c', isKhmer)} ${CalendarWords.number(info.lunar.buddhistYear, isKhmer)}
              </div>
            </div>

            <div class="card-divider" style="margin: 4px 0;"></div>

            <!-- Category & Description -->
            <div style="font-weight: 600; color: var(--accent);">
              ${event.basis === 'calculated' ? L.text('rules.calculated_label', isKhmer) :
                event.kind === 'HOLIDAY' ? L.text('ui.holiday.253332', isKhmer) :
                event.kind === 'HOLY_DAY' ? L.text('ui.holy_day.28786d', isKhmer) :
                event.kind === 'OBSERVANCE' ? L.text('ui.observance.5b9a87', isKhmer) :
                L.text('ui.custom.917053', isKhmer)}
            </div>
            ${!isCustom ? `
              <div style="font-size: calc(13px * var(--font-scale)); color: var(--on-surface-variant);">
                ${escapeHtml(isKhmer ? event.titleEn : event.titleKm)}
              </div>
            ` : ''}
            ${categoryDesc ? `<div style="font-size: calc(${isEngineCalculated ? '12px' : '13px'} * var(--font-scale)); line-height: 1.6; color: var(--on-surface-variant);">${categoryDesc}</div>` : ''}

            ${(event.kind === 'HOLIDAY' && ((isKhmer ? event.citationKm : event.citationEn) || event.citation)) ? `
              <div class="event-citation" style="font-size: calc(12.5px * var(--font-scale)); line-height: 1.5; color: var(--on-surface-variant); margin-top: 2px;">
                ${escapeHtml(((isKhmer ? event.citationKm : event.citationEn) || event.citation)!)}
              </div>
            ` : ''}
          </div>

          ${isCustom ? `<div class="event-delete-confirmation" hidden>
            <p class="form-error" role="alert">${L.text(event.seriesId ? 'repeat.delete_confirm' : 'ui.delete_this_event.925263', isKhmer)}</p>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
              <button class="btn-today-pill btn-cancel-delete">${L.text('ui.cancel.5bf834', isKhmer)}</button>
              <button class="btn-today-pill btn-confirm-delete" style="color: var(--tertiary);">${L.text('ui.delete.4708f4', isKhmer)}</button>
            </div>
          </div>` : ''}
          <div class="event-detail-actions" style="display: flex; justify-content: ${isCustom ? 'space-between' : 'flex-end'}; align-items: center; margin-top: 24px;">
            ${isCustom ? `
              <button class="btn-today-pill btn-ev-delete" ${event.seriesId ? 'data-series' : ''} style="color: #FF5252; background: transparent; border: 1px solid #FF5252;">
                ${L.text(event.seriesId ? 'repeat.delete_series' : 'ui.delete.4708f4', isKhmer)}
              </button>
              <div style="display: flex; gap: 8px;">
                <button class="btn-today-pill btn-ev-edit" style="border: 1px solid var(--outline); background: transparent;">
                  ${L.text(event.seriesId ? 'repeat.edit_series' : 'ui.edit.bbdcac', isKhmer)}
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

    this.cleanupTitleCopy = setupCopyButton(
      this.overlay.querySelector<HTMLButtonElement>('.btn-copy-title')!,
      this.overlay.querySelector<HTMLElement>('.event-title-copy-status')!,
      title,
      {
        copied: L.text('ui.event_title_copied', isKhmer),
        failed: L.text('ui.could_not_copy_event_title', isKhmer)
      }
    );
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
          this.onDelete(event.seriesId || event.id);
          this.close();
        } catch {
          this.overlay.querySelector('.form-error')!.textContent = L.text('ui.could_not_save_changes_please_try_again.140b3e', isKhmer);
        }
      });
    }

    showModal(this.overlay, title);
  }

  close() {
    this.cleanupTitleCopy?.();
    this.cleanupTitleCopy = undefined;
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
  private repeatField?: EventRepeatField;

  constructor(onSaved: (event: CustomEvent) => void) {
    this.onSaved = onSaved;

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    setupModal(this.overlay, () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.body.appendChild(this.overlay);
  }

  open(dateStr: string, isKhmer: boolean, existing?: CustomEvent) {
    this.cleanupTimeField?.();
    this.cleanupTimeField = undefined;
    this.repeatField?.dispose();
    const isEdit = !!existing;
    const initialTitle = existing?.title || '';
    const initialDate = existing?.date || dateStr;
    const initialTime = existing ? existing.time || '' : '09:00';
    const initialNotes = existing?.notes || '';
    const zone = Storage.getSettings().todayTimeZone;
    const seriesZone = existing?.repeat?.timeZone || namedTimeZone(zone);
    const editorZone = existing?.repeat ? seriesZone : zone;
    const displayZone = existing?.repeat && seriesZone !== namedTimeZone(zone) ? seriesZone : zone;
    const zoneLabel = displayZone === 'local' ? L.text('ui.local_short', isKhmer)
      : displayZone === 'cambodia' || displayZone === 'Asia/Phnom_Penh' ? L.text('ui.cambodia_short', isKhmer)
      : displayZone;
    const nativeTimePicker = prefersNativeTimePicker();

    this.overlay.innerHTML = `
      <div class="modal-dialog-surface event-editor-dialog ${nativeTimePicker ? '' : 'custom-time-editor'}">
        <div class="event-editor-header">
          <div class="event-editor-title">${L.text(existing?.repeat ? 'repeat.edit_series' : isEdit ? 'ui.edit_event.c29d7a' : 'ui.add_event.bf2f10', isKhmer)}</div>
          <div class="event-time-zone">${escapeHtml(zoneLabel)} <span class="event-time-zone-offset"></span></div>
        </div>

        <form id="custom-event-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label for="ev-title" style="display: block; font-size: calc(13px * var(--font-scale)); font-weight: 500; color: var(--on-surface-variant); margin-bottom: 4px;">
              ${L.text('ui.title.a4c172', isKhmer)} <span class="required-marker">*</span>
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
            <textarea id="ev-notes" rows="2" maxlength="2000"
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--outline); background: var(--bg-surface); color: var(--text-primary); font-size: calc(14px * var(--font-scale)); box-sizing: border-box; resize: vertical;">${escapeHtml(initialNotes)}</textarea>
          </div>

          <div class="event-repeat-block" role="group" aria-labelledby="ev-repeat-label"></div>

          ${existing?.repeat ? `<p class="settings-subtitle">${L.text('repeat.edit_hint', isKhmer)}</p>` : ''}
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
    this.repeatField = new EventRepeatField(form.querySelector('.event-repeat-block')!, form.querySelector('#ev-date')!, isKhmer, seriesZone, existing?.repeat);
    if (!nativeTimePicker) {
      this.cleanupTimeField = setupTimeField(
        form.querySelector('.custom-time-field')!, form.querySelector<HTMLInputElement>('#ev-time')!, isKhmer
      );
    }
    const updateZoneOffset = () => {
      const date = form.querySelector<HTMLInputElement>('#ev-date')!.value;
      const time = form.querySelector<HTMLInputElement>('#ev-time')!.value;
      const instant = eventInstant(date, time || '12:00', editorZone)
        ?? eventInstant(date, '12:00', editorZone);
      this.overlay.querySelector('.event-time-zone-offset')!.textContent =
        `(${timeZoneOffsetLabel(editorZone, instant ? new Date(instant) : new Date())})`;
    };
    for (const id of ['#ev-date', '#ev-time']) {
      form.querySelector(id)!.addEventListener('input', updateZoneOffset);
      form.querySelector(id)!.addEventListener('change', updateZoneOffset);
    }
    updateZoneOffset();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = (this.overlay.querySelector('#ev-title') as HTMLInputElement).value.trim();
      const date = (this.overlay.querySelector('#ev-date') as HTMLInputElement).value;
      const time = (this.overlay.querySelector('#ev-time') as HTMLInputElement).value;
      const notes = (this.overlay.querySelector('#ev-notes') as HTMLTextAreaElement).value.trim();

      if (!title || !isSupportedDate(date)) return;
      if (!this.repeatField!.validate()) return;
      const instant = time ? eventInstant(date, time, editorZone) : undefined;
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
        instant: existing?.instant && date === initialDate && time === initialTime ? existing.instant : instant,
        remind: existing?.remind,
        repeat: this.repeatField!.value()
      };

      try { Storage.saveCustomEventSync(event); }
      catch {
        error.textContent = L.text('ui.could_not_save_changes_please_try_again.140b3e', isKhmer);
        return;
      }
      this.close();
      this.onSaved(event);
    });

    showModal(this.overlay, L.text(existing?.repeat ? 'repeat.edit_series' : isEdit ? 'ui.edit_event.c29d7a' : 'ui.add_event.bf2f10', isKhmer));
  }

  close() {
    this.cleanupTimeField?.();
    this.cleanupTimeField = undefined;
    this.repeatField?.dispose();
    this.repeatField = undefined;
    hideModal(this.overlay);
  }
}
