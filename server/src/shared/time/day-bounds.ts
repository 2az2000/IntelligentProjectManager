/**
 * §2.10: calendar days are a *local* concept, but every timestamp in the database is an
 * instant. Computing "today" with `new Date().setHours(0, 0, 0, 0)` uses the server's zone —
 * and the production images run in UTC, so "today" started at 03:30 in Tehran and the 08:00
 * digest fired at 11:30.
 *
 * Everything that needs a day boundary goes through this module instead: it converts an instant
 * to the wall-clock date in a named IANA zone and back to the UTC instant of that midnight.
 */

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

function partsIn(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/** Milliseconds the zone is ahead of UTC at that instant (Tehran = +3:30 → 12600000). */
function offsetMs(date: Date, timeZone: string): number {
  const parts = partsIn(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  // `formatToParts` drops the milliseconds; compare against the second-aligned instant so a
  // date like 10:00:00.750 does not skew the offset by 750ms.
  const aligned = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - aligned;
}

/**
 * The instant at which the calendar day containing `at` starts in `timeZone`.
 * Example: for `Asia/Tehran`, 2026-10-24T21:00Z is 00:30 on the 25th, so this returns
 * 2026-10-24T20:30:00.000Z.
 */
export function startOfDayIn(timeZone: string, at: Date = new Date()): Date {
  const { year, month, day } = partsIn(at, timeZone);
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  // Two passes: the first guess uses the offset at 00:00 UTC, the second corrects zones whose
  // offset changes at the local midnight (DST transitions).
  const guess = utcMidnight - offsetMs(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offsetMs(new Date(guess), timeZone));
}

/** Last millisecond of that calendar day (inclusive), matching the `lte` filters in queries. */
export function endOfDayIn(timeZone: string, at: Date = new Date()): Date {
  const start = startOfDayIn(timeZone, at);
  // +36h lands inside the next local day even across a 25-hour DST day.
  const next = startOfDayIn(timeZone, new Date(start.getTime() + 36 * 60 * 60 * 1000));
  return new Date(next.getTime() - 1);
}

export interface DayBounds {
  start: Date;
  end: Date;
}

export function dayBounds(timeZone: string, at: Date = new Date()): DayBounds {
  return { start: startOfDayIn(timeZone, at), end: endOfDayIn(timeZone, at) };
}

/**
 * Whole calendar days between two instants, counted midnight-to-midnight in `timeZone`
 * (22:00 and 02:00 on the next local day are one day apart, not "0.16 days").
 */
export function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  const start = startOfDayIn(timeZone, from).getTime();
  const end = startOfDayIn(timeZone, to).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}
