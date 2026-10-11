// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import type { CalendarEvent } from '../data/EventRepository';
import { CalendarWords } from '../data/i18n';
import { Storage } from '../data/Storage';
import { TodayTimeZone } from '../domain/DateTime';
import { KhmerCalendar } from '../domain/KhmerCalendar';
import { escapeHtml } from './html';
import { eventTitleWithTime, formatEventSubtitle } from './EventTime';
import { holyDayLotus } from './HolyDayLotus';

export function timelineBoundary(date: string, nextDate: string | undefined, today: string | undefined,
  todayInDays: boolean): { highlight: boolean; node: boolean } {
  const node = !!(nextDate && today && !todayInDays && date.slice(0, 7) === today.slice(0, 7)
    && date < today && nextDate > today);
  return { highlight: !!nextDate && (nextDate === today || node), node };
}

/** One clickable date column per day; each event keeps its own accessible button. */
export function renderEventRows(events: readonly CalendarEvent[], khmer: boolean, today?: string, zone?: TodayTimeZone): string {
  const activeZone = zone ?? Storage.getSettings().todayTimeZone;
  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = days.get(event.date);
    if (day) day.push(event);
    else days.set(event.date, [event]);
  }
  const entries = [...days];
  const todayInDays = !!today && days.has(today);
  return entries.map(([date, dayEvents], dayIndex) => {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const dateLabel = CalendarWords.date(year, month, day, khmer);
    const holiday = dayEvents.some(event => event.kind === 'HOLIDAY');
    const daynumClass = holiday ? ' holiday' : '';
    const boundary = timelineBoundary(date, entries[dayIndex + 1]?.[0], today, todayInDays);
    const lotus = dayEvents.some(event => event.kind === 'HOLY_DAY')
      ? holyDayLotus(KhmerCalendar.fromGregorian(year, month, day)) : undefined;
    return `<div class="event-day-group${date === today ? ' is-today' : ''}" data-date="${escapeHtml(date)}" role="group" aria-label="${escapeHtml(dateLabel)}"${date === today ? ' aria-current="date"' : ''}>
      <div class="event-day-content">
        <button type="button" class="event-row-date" data-open-date="${escapeHtml(date)}" aria-label="${escapeHtml(dateLabel)}" aria-haspopup="dialog">
          <span class="event-row-daynum${daynumClass}">${CalendarWords.number(day, khmer)}</span>
          <span class="event-row-weekday">${CalendarWords.weekday(weekday, khmer, 'short')}</span>
        </button>
        <div class="event-day-events">
      ${dayEvents.map(event => {
        const kind = event.kind.toLowerCase();
        const title = khmer ? event.titleKm : event.titleEn;
        const subtitle = formatEventSubtitle(event, khmer, activeZone, false);
        return `<button type="button" class="event-row-card${event.kind === 'CUSTOM' ? ' custom-event-row' : event.kind === 'HOLY_DAY' ? ' holy-day-event-row' : ''}"${event.kind === 'HOLY_DAY' ? ` style="--event-lotus-image: url('${lotus}')"` : ''} data-event-id="${escapeHtml(event.id)}" data-event-date="${escapeHtml(date)}" aria-label="${escapeHtml(`${eventTitleWithTime(event, khmer)}, ${dateLabel}, ${subtitle}`)}">
          <div class="event-row-content">
            <span class="event-row-title">${event.time ? `<span class="event-row-time">${escapeHtml(event.time)}</span>` : ''}<span>${escapeHtml(title)}</span></span>
            <span class="event-row-kind ${kind}">${escapeHtml(subtitle)}</span>
          </div>
          <span class="event-row-chevron" aria-hidden="true">›</span>
        </button>`;
      }).join('')}
        </div>
      </div>
      ${dayIndex < entries.length - 1 ? `<div class="event-day-divider${date === today || boundary.highlight ? ' highlighted' : ''}${boundary.node ? ' has-today-node' : ''}" aria-hidden="true"></div>` : ''}
    </div>`;
  }).join('');
}
