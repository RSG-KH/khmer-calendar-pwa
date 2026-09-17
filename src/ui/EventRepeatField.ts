// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import { CalendarWords, L } from '../data/i18n';
import { isSupportedDate } from '../domain/DateTime';
import { EventRepeat, RepeatFrequency, repeatDates, validRepeat } from '../domain/EventRepeat';
import { escapeHtml } from './html';

export function repeatDateLabel(date: string, khmer: boolean): string {
  const [year, month, day] = date.split('-').map(Number);
  const monthName = CalendarWords.month(month, khmer, true);
  const label = khmer ? `${CalendarWords.number(day, true)} ${monthName}` : `${monthName} ${day}`;
  return `${label}${khmer ? ' ' : ', '}${CalendarWords.number(year, khmer)}`;
}

export class EventRepeatField {
  private frequency: RepeatFrequency | 'none';
  private abort = new AbortController();
  private interval: HTMLInputElement;
  private end: HTMLInputElement;
  private thirty: HTMLInputElement;
  private february: HTMLInputElement;

  constructor(private root: HTMLElement, private start: HTMLInputElement, private khmer: boolean,
    private timeZone: string, initial?: EventRepeat) {
    this.frequency = initial?.frequency ?? 'none';
    const t = (key: string) => L.text(`repeat.${key}`, khmer);
    root.innerHTML = `
      <span class="event-repeat-label" id="ev-repeat-label">${t('label')}</span>
      <div class="event-repeat-choices" role="group" aria-labelledby="ev-repeat-label">
        ${(['none', 'days', 'weekly', 'monthly', 'yearly'] as const).map(value => `
          <button type="button" class="filter-chip" data-repeat="${value}" aria-pressed="false">${t(value)}</button>
        `).join('')}
      </div>
      <div class="event-repeat-interval" hidden>
        <label class="event-repeat-label" for="ev-repeat-interval">${t('interval')}</label>
        <input id="ev-repeat-interval" type="number" min="1" step="1" inputmode="numeric" />
      </div>
      <div class="event-repeat-end" hidden>
        <label class="event-repeat-label" for="ev-repeat-end">${t('end')} <span class="required-marker">*</span></label>
        <div class="event-native-field"><input id="ev-repeat-end" type="date" max="2200-12-31" /></div>
      </div>
      <div class="event-repeat-short" hidden>
        <label class="event-repeat-toggle event-repeat-thirty"><span>${t('include_thirty')}</span><input class="settings-switch" type="checkbox" role="switch" /></label>
        <label class="event-repeat-toggle event-repeat-february"><span></span><input class="settings-switch" type="checkbox" role="switch" /></label>
      </div>
      <div class="event-repeat-preview" aria-live="polite" aria-atomic="true" hidden>
        <p class="event-repeat-label">${t('scheduled')}</p>
        <div class="event-repeat-dates"></div>
        <p class="settings-subtitle event-repeat-count"></p>
        <p class="settings-subtitle event-repeat-skipped" hidden></p>
      </div>`;
    this.interval = root.querySelector('#ev-repeat-interval')!;
    this.end = root.querySelector('#ev-repeat-end')!;
    this.thirty = root.querySelector('.event-repeat-thirty input')!;
    this.february = root.querySelector('.event-repeat-february input')!;
    this.interval.value = initial?.interval?.toString() ?? '3';
    this.end.value = initial?.until ?? '';
    this.thirty.checked = initial?.includeThirty ?? false;
    this.february.checked = initial?.includeFebruary ?? false;
    const options = { signal: this.abort.signal };
    root.querySelectorAll<HTMLButtonElement>('[data-repeat]').forEach(button => {
      button.addEventListener('click', () => {
        this.frequency = button.dataset.repeat as typeof this.frequency;
        this.render();
      }, options);
    });
    [start, this.interval, this.end, this.thirty, this.february].forEach(input => input.addEventListener('input', () => this.render(), options));
    this.render();
  }

  value(): EventRepeat | undefined {
    if (this.frequency === 'none') return undefined;
    return {
      frequency: this.frequency, until: this.end.value, timeZone: this.timeZone,
      ...(this.frequency === 'days' ? { interval: Number(this.interval.value) } : {}),
      ...(this.frequency === 'monthly' ? { includeThirty: this.thirty.checked } : {}),
      ...(['monthly', 'yearly'].includes(this.frequency) ? { includeFebruary: this.february.checked } : {})
    };
  }

  validate(): boolean {
    this.render();
    return this.interval.reportValidity() && this.end.reportValidity();
  }

  dispose() { this.abort.abort(); }

  private render() {
    const find = (selector: string) => this.root.querySelector<HTMLElement>(selector)!;
    const t = (key: string, values = {}) => L.text(`repeat.${key}`, this.khmer, values);
    const rule = this.value();
    const date = this.start.value;
    const validDate = isSupportedDate(date);
    this.root.querySelectorAll<HTMLButtonElement>('[data-repeat]').forEach(button => {
      const active = button.dataset.repeat === this.frequency;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    find('.event-repeat-interval').hidden = this.frequency !== 'days';
    this.interval.disabled = this.frequency !== 'days';
    this.interval.required = !this.interval.disabled;
    this.interval.setCustomValidity(!this.interval.disabled && (!Number.isSafeInteger(Number(this.interval.value)) || Number(this.interval.value) < 1)
      ? t('invalid_interval') : '');
    find('.event-repeat-end').hidden = !rule;
    this.end.disabled = !rule;
    this.end.required = !!rule;
    this.end.min = validDate ? date : '1800-01-01';
    this.end.setCustomValidity(!rule ? '' : !this.end.value ? t('required_end')
      : !isSupportedDate(this.end.value) || this.end.value < date ? t('invalid_end') : '');
    find('.event-repeat-short').hidden = true;
    find('.event-repeat-preview').hidden = true;
    if (!rule || !validDate) return;
    const day = Number(date.slice(8));
    if (!validRepeat(date, rule)) return;
    const result = repeatDates(date, rule);
    find('.event-repeat-short').hidden = !(result.affectsThirty || result.affectsFebruary);
    find('.event-repeat-thirty').hidden = !result.affectsThirty;
    find('.event-repeat-february').hidden = !result.affectsFebruary;
    find('.event-repeat-february span').textContent = t(day === 29 ? 'include_february_28' : 'include_february');
    const dates = result.dates;
    const display = dates.length > 5 ? [...dates.slice(0, 3), null, dates[dates.length - 1]] : dates;
    find('.event-repeat-dates').innerHTML = display.map(value => value
      ? `<span class="event-repeat-date">${escapeHtml(repeatDateLabel(value, this.khmer))}</span>`
      : `<span aria-label="${t('more')}">…</span>`).join('');
    find('.event-repeat-count').textContent = t(dates.length === 1 ? 'count_one' : 'count_many', {
      count: CalendarWords.number(dates.length, this.khmer), date: repeatDateLabel(dates[dates.length - 1], this.khmer)
    });
    const skips = find('.event-repeat-skipped');
    skips.hidden = !result.skipped.length;
    skips.textContent = t('skipped', { dates: result.skipped.slice(0, 3).map(value => {
      const [year, month] = value.split('-').map(Number);
      return this.frequency === 'yearly' ? CalendarWords.number(year, this.khmer)
        : `${CalendarWords.month(month, this.khmer, true)} ${CalendarWords.number(year, this.khmer)}`;
    }).join(', ') + (result.skipped.length > 3 ? ' …' : '') });
    find('.event-repeat-preview').hidden = false;
  }
}
