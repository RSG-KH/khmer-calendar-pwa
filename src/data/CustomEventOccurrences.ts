// Copyright (c) 2026 RSG-KH | Apache-2.0 License

import type { CustomEvent } from './Storage';
import { dateTimeInZone, zonedEventInstant } from '../domain/DateTime';
import { paddedDateRange, repeatDates } from '../domain/EventRepeat';

export type CustomOccurrence = CustomEvent & { seriesId?: string };

export function customEventOccurrences(event: CustomEvent, from: string, through: string, displayZone: string): CustomOccurrence[] {
  if (!event.repeat) return event.date >= from && event.date <= through ? [event] : [];
  const repeat = event.repeat;
  const range = event.time ? paddedDateRange(from, through) : [from, through];
  const dates = repeatDates(event.date, repeat, range[0], range[1]).dates;
  return dates.flatMap(date => {
    const instant = event.time
      ? date === event.date && event.instant ? event.instant : zonedEventInstant(date, event.time, repeat.timeZone, true)
      : undefined;
    const displayed = instant ? dateTimeInZone(new Date(instant), displayZone) : { date, time: event.time };
    if (displayed.date < from || displayed.date > through) return [];
    return [{ ...event, ...displayed, instant, id: `${event.id}@${date}`, seriesId: event.id }];
  });
}
