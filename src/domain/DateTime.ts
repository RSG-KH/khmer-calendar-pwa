export type TodayTimeZone = 'local' | 'cambodia';

export function localOffsetLabel(now = new Date()): string {
  return offsetLabel(-now.getTimezoneOffset());
}

function offsetLabel(offset: number): string {
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return `UTC${offset >= 0 ? '+' : '-'}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

export function namedTimeZone(zone: string): string {
  return zone === 'cambodia' ? 'Asia/Phnom_Penh'
    : zone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : zone;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateTimeInZone(now: Date, zone: string): { date: string; time: string } {
  const name = namedTimeZone(zone);
  let formatter = formatters.get(name);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: name,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    formatters.set(name, formatter);
  }
  const parts = formatter.formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

export function timeZoneOffsetLabel(zone: string, at = new Date()): string {
  const { date, time } = dateTimeInZone(at, zone);
  const utcMinute = Math.floor(at.getTime() / 60_000) * 60_000;
  return offsetLabel((Date.parse(`${date}T${time}:00Z`) - utcMinute) / 60_000);
}

export function todayInZone(zone: TodayTimeZone, now = new Date()): string {
  return dateTimeInZone(now, zone).date;
}

export function isSupportedDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1800-01-01' || date > '2200-12-31') return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function eventInstant(date: string, time: string, zone: string): string | undefined {
  if (!isSupportedDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  if (zone !== 'local' && zone !== 'cambodia') return zonedEventInstant(date, time, zone);
  const chosen = new Date(`${date}T${time}:00${zone === 'cambodia' ? '+07:00' : ''}`);
  if (Number.isNaN(chosen.getTime())) return undefined;
  const roundTrip = dateTimeInZone(chosen, zone);
  // Reject local times skipped when daylight saving time starts.
  if (roundTrip.date !== date || roundTrip.time !== time) return undefined;
  return chosen.toISOString();
}

/** Resolve wall time in a saved IANA zone. Folds use the earlier instant; future
 * recurrence gaps move forward by the clock change, without moving the anchor. */
export function zonedEventInstant(date: string, time: string, zone: string, shiftGap = false): string | undefined {
  if (!isSupportedDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const target = Date.parse(`${date}T${time}:00Z`);
  const civilMillis = (instant: number) => {
    const parts = dateTimeInZone(new Date(instant), zone);
    return Date.parse(`${parts.date}T${parts.time}:00Z`);
  };
  const offsets = new Set([-2, 0, 2].map(days => {
    const sample = target + days * 86_400_000;
    return civilMillis(sample) - sample;
  }));
  const candidates = [...offsets].map(offset => target - offset).sort((a, b) => a - b);
  const exact = candidates.find(candidate => civilMillis(candidate) === target);
  const resolved = exact ?? (shiftGap ? candidates.find(candidate => civilMillis(candidate) > target) : undefined);
  return resolved === undefined ? undefined : new Date(resolved).toISOString();
}
