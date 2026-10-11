import { CalendarWords, L } from '../data/i18n';
import { Storage } from '../data/Storage';
import { isSupportedDate, todayInZone } from '../domain/DateTime';
import { adjacentMonth, bindDatePickerSwipe } from './MonthSwipe';
import { hideModal, setupModal, showModal } from './Modal';
import { Icons } from './Icons';
import { escapeHtml } from './html';

export function eventDateCells(year: number, month: number, mondayFirst: boolean): (string | null)[] {
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + (mondayFirst ? 6 : 0)) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, slot) => {
    const day = slot - offset + 1;
    return day < 1 || day > count ? null : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
}

/** App-language calendar with Latin numeric entry, shared by event and repeat end. */
export function setupEventDateField(input: HTMLInputElement, khmer: boolean): () => void {
  const wrapper = input.parentElement!;
  const parent = input.closest<HTMLElement>('.modal-overlay')!;
  const abort = new AbortController();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-event-date-pick';
  button.textContent = L.text('ui.pick.971faf', khmer);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', `${L.text('ui.pick.971faf', khmer)}: ${input.labels?.[0]?.textContent?.trim() ?? ''}`);
  wrapper.classList.add('event-date-field');
  input.type = 'text';
  input.placeholder = 'YYYY-MM-DD';
  input.maxLength = 10;
  wrapper.append(button);
  let overlay: HTMLElement | undefined;
  let cleanupSwipe: (() => void) | undefined;
  let year = 2000, month = 1, selected = '';
  const settings = Storage.getSettings();
  const valid = (date: string) => isSupportedDate(date) && date >= (input.min || '1800-01-01') && date <= (input.max || '2200-12-31');
  const validate = () => input.setCustomValidity(input.disabled || !input.required && !input.value || valid(input.value)
    ? '' : L.text(input.id === 'ev-repeat-end' ? 'repeat.invalid_end' : 'ui.date_range_error', khmer));
  const close = () => {
    if (!overlay) return;
    cleanupSwipe?.();
    cleanupSwipe = undefined;
    parent.inert = false;
    hideModal(overlay);
    overlay.remove();
    overlay = undefined;
  };
  const commit = () => {
    if (!valid(selected) || !overlay?.querySelector<HTMLInputElement>('.event-date-year')?.checkValidity()) return;
    input.value = selected;
    validate();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  const renderGrid = () => {
    if (!overlay) return;
    const yearInput = overlay.querySelector<HTMLInputElement>('.event-date-year')!;
    if (!yearInput.value || !yearInput.checkValidity()) {
      overlay.querySelector('.event-date-grid')!.innerHTML = '';
      overlay.querySelector<HTMLButtonElement>('.event-date-save')!.disabled = true;
      return;
    }
    const weekdayOrder = Array.from({ length: 7 }, (_, index) => (index + (settings.mondayFirst ? 1 : 0)) % 7);
    overlay.querySelector('.event-date-weekdays')!.innerHTML = weekdayOrder.map(day =>
      `<span aria-label="${escapeHtml(CalendarWords.weekday(day, khmer))}">${CalendarWords.weekday(day, khmer, 'short')}</span>`).join('');
    overlay.querySelector('.event-date-grid')!.innerHTML = eventDateCells(year, month, settings.mondayFirst).map(date =>
      date ? `<button type="button" data-pick-date="${date}" aria-label="${escapeHtml(CalendarWords.date(year, month, Number(date.slice(8)), khmer))}" aria-pressed="${date === selected}" ${valid(date) ? '' : 'disabled'}>${Number(date.slice(8))}</button>` : '<span></span>').join('');
    overlay.querySelectorAll<HTMLButtonElement>('[data-pick-date]').forEach(day => day.addEventListener('click', () => {
      selected = day.dataset.pickDate!;
      renderGrid();
      overlay?.querySelector<HTMLButtonElement>(`[data-pick-date="${selected}"]`)?.focus();
    }));
    overlay.querySelector<HTMLButtonElement>('.event-date-save')!.disabled = !valid(selected);
    overlay.querySelector<HTMLButtonElement>('.event-date-prev')!.disabled = year === 1800 && month === 1;
    overlay.querySelector<HTMLButtonElement>('.event-date-next')!.disabled = year === 2200 && month === 12;
  };
  const move = (direction: -1 | 1) => {
    const next = adjacentMonth(year, month, direction);
    if (!next || !overlay) return;
    ({ year, month } = next);
    overlay.querySelector<HTMLSelectElement>('.event-date-month')!.value = String(month);
    overlay.querySelector<HTMLInputElement>('.event-date-year')!.value = String(year);
    renderGrid();
  };
  button.addEventListener('click', () => {
    if (input.disabled || overlay) return;
    selected = valid(input.value) ? input.value : '';
    const fallback = valid(todayInZone(settings.todayTimeZone)) ? todayInZone(settings.todayTimeZone) : input.min || '1800-01-01';
    [year, month] = (selected || fallback).split('-').map(Number);
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay event-date-overlay';
    setupModal(overlay, close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.innerHTML = `<div class="modal-dialog-surface event-date-dialog">
      <div class="event-date-heading">${L.text('ui.select_date', khmer)}</div>
      <div class="event-date-navigation">
        <button type="button" class="arrow-btn event-date-prev" aria-label="${L.text('ui.previous_month.c03e1f', khmer)}">${Icons.chevronLeft}</button>
        <select class="event-date-month" aria-label="${L.text('ui.month', khmer)}">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${index + 1 === month ? 'selected' : ''}>${CalendarWords.month(index + 1, khmer)}</option>`).join('')}</select>
        <input class="event-date-year" type="number" required min="1800" max="2200" value="${year}" aria-label="${L.text('ui.year.61d597', khmer)} · 1800–2200" />
        <button type="button" class="arrow-btn event-date-next" aria-label="${L.text('ui.next_month.d2d40f', khmer)}">${Icons.chevronRight}</button>
      </div>
      <div class="event-date-weekdays"></div><div class="event-date-grid"></div>
      <div class="event-date-actions"><button type="button" class="btn-today-pill event-date-cancel">${L.text('ui.cancel.5bf834', khmer)}</button><button type="button" class="btn-today-pill event-date-save">${L.text('ui.ok.04c4aa', khmer)}</button></div>
    </div>`;
    overlay.querySelector('.event-date-prev')!.addEventListener('click', () => move(-1));
    overlay.querySelector('.event-date-next')!.addEventListener('click', () => move(1));
    overlay.querySelector<HTMLSelectElement>('.event-date-month')!.addEventListener('change', event => {
      month = Number((event.target as HTMLSelectElement).value); renderGrid();
    });
    overlay.querySelector<HTMLInputElement>('.event-date-year')!.addEventListener('input', event => {
      const value = Number((event.target as HTMLInputElement).value);
      if (Number.isInteger(value) && value >= 1800 && value <= 2200) { year = value; renderGrid(); }
      else { overlay!.querySelector('.event-date-grid')!.innerHTML = ''; overlay!.querySelector<HTMLButtonElement>('.event-date-save')!.disabled = true; }
    });
    overlay.querySelector('.event-date-cancel')!.addEventListener('click', close);
    overlay.querySelector('.event-date-save')!.addEventListener('click', commit);
    document.body.append(overlay);
    renderGrid();
    parent.inert = true;
    showModal(overlay, L.text('ui.select_date', khmer));
    cleanupSwipe = bindDatePickerSwipe(overlay, move);
  }, { signal: abort.signal });
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[០-៩]/g, digit => String(digit.charCodeAt(0) - 0x17e0));
    validate();
  }, { signal: abort.signal, capture: true });
  validate();
  return () => { close(); abort.abort(); button.remove(); };
}
