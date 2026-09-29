// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import type { CalendarEvent } from '../data/EventRepository';
import { CalendarWords } from '../data/i18n';
import { Storage } from '../data/Storage';
import { TodayTimeZone } from '../domain/DateTime';
import { escapeHtml } from './html';
import { formatEventSubtitle } from './EventTime';

/** Render repository-ordered events with a single visible date per day. */
export function renderEventRows(events: readonly CalendarEvent[], khmer: boolean, today?: string, zone?: TodayTimeZone): string {
  const activeZone = zone ?? Storage.getSettings().todayTimeZone;
  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = days.get(event.date);
    if (day) day.push(event);
    else days.set(event.date, [event]);
  }
  return Array.from(days, ([date, dayEvents]) => {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const dateLabel = CalendarWords.date(year, month, day, khmer);
    const holiday = dayEvents.some(event => event.kind === 'HOLIDAY');
    return `<div class="event-day-group${date === today ? ' is-today' : ''}" data-date="${escapeHtml(date)}" role="group" aria-label="${escapeHtml(dateLabel)}"${date === today ? ' aria-current="date"' : ''}>
      ${dayEvents.map((event, index) => {
        const kind = event.kind.toLowerCase();
        const title = khmer ? event.titleKm : event.titleEn;
        const subtitle = formatEventSubtitle(event, khmer, activeZone);
        return `<button class="event-row-card${event.kind === 'CUSTOM' ? ' custom-event-row' : ''}" data-event-id="${escapeHtml(event.id)}" data-event-date="${escapeHtml(date)}" aria-label="${escapeHtml(`${title}, ${dateLabel}, ${subtitle}`)}">
          <div class="event-row-date" aria-hidden="true">${index === 0 ? `
            <span class="event-row-daynum${holiday ? ' holiday' : ''}">${CalendarWords.number(day, khmer)}</span>
            <span class="event-row-weekday">${CalendarWords.weekday(weekday, khmer, 'short')}</span>
          ` : ''}</div>
          <div class="event-row-bar ${kind}"></div>
          <div class="event-row-content">
            <span class="event-row-title">${escapeHtml(title)}</span>
            <span class="event-row-kind ${kind}">${escapeHtml(subtitle)}</span>
          </div>
          <span class="event-row-chevron" aria-hidden="true">›</span>
        </button>`;
      }).join('')}
    </div>`;
  }).join('');
}
