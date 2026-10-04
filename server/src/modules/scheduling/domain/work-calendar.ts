/**
 * Working-day calendar for scheduling. Weekend days are configurable via
 * WORKING_WEEKEND (default THURSDAY,FRIDAY — the Iranian weekend); every hour
 * of a working day counts, so estimates are calendar hours minus weekends.
 */

export const WEEKDAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

const byName = new Map(WEEKDAY_NAMES.map((name, index) => [name, index] as const));

/** "THURSDAY,FRIDAY" → {4, 5} (JS getDay(): 0=Sunday). Unknown names are ignored. */
export function parseWeekend(spec: string): Set<number> {
  return new Set(
    spec
      .split(',')
      .map((name) => byName.get(name.trim().toUpperCase() as (typeof WEEKDAY_NAMES)[number]))
      .filter((index): index is number => index !== undefined),
  );
}

export function isWorkingDay(date: Date, weekend: Set<number>): boolean {
  return !weekend.has(date.getDay());
}

const HOUR = 60 * 60 * 1000;

/**
 * Adds `hours` of working time to `start`: hour-by-hour, skipping weekend days.
 * Zero-duration calls return the next working instant (a weekend start rolls forward).
 */
export function addWorkingHours(start: Date, hours: number, weekend: Set<number>): Date {
  let current = new Date(start.getTime());
  let remaining = Math.max(0, hours);

  // Roll the start forward onto a working day without consuming hours.
  while (!isWorkingDay(current, weekend)) current = new Date(current.getTime() + 24 * HOUR);

  while (remaining > 0) {
    current = new Date(current.getTime() + HOUR);
    if (isWorkingDay(current, weekend)) remaining -= 1;
  }
  if (!isWorkingDay(current, weekend)) {
    // Duration 0 landing on a weekend: park at the next working instant.
    while (!isWorkingDay(current, weekend)) current = new Date(current.getTime() + 24 * HOUR);
  }
  return current;
}
