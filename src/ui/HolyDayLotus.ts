import type { LunarDate } from '../domain/KhmerCalendar';

/** Call for a holy day or its shaving eve; the engine owns eligibility. */
export function holyDayLotus(lunar: Pick<LunarDate, 'day'>): string {
  return `${import.meta.env.BASE_URL}assets/drawables/${lunar.day <= 8 ? 'holy_day_lotus' : 'holy_day_lotus_blossom'}.png`;
}
