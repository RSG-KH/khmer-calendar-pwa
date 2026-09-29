// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import type { CalendarEvent } from '../data/EventRepository';
import { CalendarWords, L } from '../data/i18n';
import { TodayTimeZone, dateTimeInZone, eventInstant, localOffsetLabel } from '../domain/DateTime';

export interface EventTimeRow {
  time: string;
  label: string;
  dateSuffix?: string;
}

export interface CustomEventTimeInfo {
  isDifferentZone: boolean;
  activeZoneLabel: string;
  rows: EventTimeRow[];
}

export function getCustomEventTimeInfo(
  event: Pick<CalendarEvent, 'date' | 'time' | 'instant'>,
  khmer: boolean,
  zone: TodayTimeZone
): CustomEventTimeInfo {
  if (!event.time) {
    return { isDifferentZone: false, activeZoneLabel: '', rows: [] };
  }

  const instantIso = event.instant ?? eventInstant(event.date, event.time, zone);
  const instantDate = instantIso ? new Date(instantIso) : new Date(`${event.date}T${event.time}:00Z`);
  const localOffset = localOffsetLabel(instantDate);
  const isDifferentZone = localOffset !== 'UTC+7';

  const localLabel = `${L.text('ui.local_time.541b44', khmer)} (${localOffset})`;
  const cambodiaLabel = L.text('ui.cambodia_time_utc_7.6b9f2d', khmer);

  const activeZoneLabel = isDifferentZone
    ? (zone === 'cambodia' ? cambodiaLabel : localLabel)
    : '';

  if (!isDifferentZone) {
    const singleLabel = zone === 'cambodia' ? cambodiaLabel : L.text('ui.local_time.541b44', khmer);
    return {
      isDifferentZone: false,
      activeZoneLabel,
      rows: [{ time: event.time, label: singleLabel }]
    };
  }

  const localDt = dateTimeInZone(instantDate, 'local');
  const cambodiaDt = dateTimeInZone(instantDate, 'cambodia');

  const formatShortDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-').map(Number);
    return khmer
      ? `${CalendarWords.number(d, true)} ${CalendarWords.month(m, true, true)}`
      : `${CalendarWords.month(m, false, true)} ${CalendarWords.number(d, false)}`;
  };

  const rows: EventTimeRow[] = [
    {
      time: localDt.time,
      label: localLabel,
      dateSuffix: localDt.date !== event.date ? formatShortDate(localDt.date) : undefined
    },
    {
      time: cambodiaDt.time,
      label: cambodiaLabel,
      dateSuffix: cambodiaDt.date !== event.date ? formatShortDate(cambodiaDt.date) : undefined
    }
  ];

  return { isDifferentZone: true, activeZoneLabel, rows };
}

export function formatEventSubtitle(
  event: Pick<CalendarEvent, 'kind' | 'date' | 'time' | 'instant'>,
  khmer: boolean,
  zone: TodayTimeZone
): string {
  const kindLabel = L.text(
    event.kind === 'HOLIDAY' ? 'ui.holiday.253332' :
    event.kind === 'HOLY_DAY' ? 'ui.holy_day.28786d' :
    event.kind === 'OBSERVANCE' ? 'ui.observance.5b9a87' : 'ui.custom.917053',
    khmer
  );

  if (!event.time) {
    return kindLabel;
  }

  if (event.kind !== 'CUSTOM') {
    return `${kindLabel} · ${event.time}`;
  }

  const info = getCustomEventTimeInfo(event, khmer, zone);
  if (info.isDifferentZone && info.activeZoneLabel) {
    return `${kindLabel} · ${event.time} · ${info.activeZoneLabel}`;
  }

  return `${kindLabel} · ${event.time}`;
}
