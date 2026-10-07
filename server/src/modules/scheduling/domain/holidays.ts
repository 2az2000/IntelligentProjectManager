/**
 * §3 Iranian official holidays — `work-calendar.ts` consults these before rolling
 * dates forward, so Nowruz / lunar holidays no longer make CPM 10–20% optimistic.
 * All helpers are pure and holiday-list-injected (no DB here).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HolidayEntry {
  /** Calendar day (time-of-day ignored). */
  date: Date;
  title: string;
  /** Recurs every year on the same Gregorian month/day (fixed holidays). */
  isRecurring: boolean;
}

/** YYYY-MM-DD key in local time — stable Map key regardless of timezone offsets. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function keyOf(holiday: HolidayEntry, year: number): string {
  const d = holiday.date;
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${m}-${day}`;
}

/**
 * A holiday set for fast lookup across a bounded date range.
 * Recurring holidays apply to every year; dated ones only to their own year.
 */
export class HolidayCalendar {
  private readonly fixed = new Map<string, string>(); // "MM-DD" -> title
  private readonly dated = new Set<string>(); // "YYYY-MM-DD"

  constructor(holidays: HolidayEntry[]) {
    for (const h of holidays) {
      if (h.isRecurring) {
        this.fixed.set(keyOf(h, 2000).slice(5), h.title);
      } else {
        this.dated.add(dayKey(h.date));
      }
    }
  }

  /** Is `date` an official holiday? */
  isHoliday(date: Date): boolean {
    const key = dayKey(date);
    return this.dated.has(key) || this.fixed.has(key.slice(5));
  }

  title(date: Date): string | undefined {
    const key = dayKey(date);
    return this.fixed.get(key.slice(5)) ?? (this.dated.has(key) ? undefined : undefined);
  }
}

/**
 * Adds `hours` of working time, skipping weekends AND official holidays.
 * Mirrors `addWorkingHours` from work-calendar but consults `holidays` too.
 */
export function addWorkingHoursWithHolidays(
  start: Date,
  hours: number,
  weekend: Set<number>,
  holidays: HolidayCalendar,
): Date {
  let current = new Date(start.getTime());
  let remaining = Math.max(0, hours);
  const notWorking = (d: Date) => !weekend.has(d.getDay()) && !holidays.isHoliday(d);

  while (!notWorking(current)) current = new Date(current.getTime() + DAY_MS);
  while (remaining > 0) {
    current = new Date(current.getTime() + 60 * 60 * 1000);
    if (notWorking(current)) remaining -= 1;
  }
  while (!notWorking(current)) current = new Date(current.getTime() + DAY_MS);
  return current;
}
