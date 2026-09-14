export type TodayTimeZone = 'local' | 'cambodia';

export function localOffsetLabel(now = new Date()): string {
  const offset = -now.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return `UTC${offset >= 0 ? '+' : '-'}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

export function dateTimeInZone(now: Date, zone: TodayTimeZone): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    ...(zone === 'cambodia' ? { timeZone: 'Asia/Phnom_Penh' } : {}),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

export function todayInZone(zone: TodayTimeZone, now = new Date()): string {
  return dateTimeInZone(now, zone).date;
}

export function isSupportedDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1800-01-01' || date > '2200-12-31') return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function eventInstant(date: string, time: string, zone: TodayTimeZone): string | undefined {
  if (!isSupportedDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const chosen = new Date(`${date}T${time}:00${zone === 'cambodia' ? '+07:00' : ''}`);
  if (Number.isNaN(chosen.getTime())) return undefined;
  const roundTrip = dateTimeInZone(chosen, zone);
  // Reject local times skipped when daylight saving time starts.
  if (roundTrip.date !== date || roundTrip.time !== time) return undefined;
  return chosen.toISOString();
}
