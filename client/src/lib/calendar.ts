import * as gregorian from 'date-fns';
import * as jalali from 'date-fns-jalali';

/** Month math in the calendar of the active locale: Persian (Jalali) for fa, Gregorian for en. */
export type CalendarSystem = 'jalali' | 'gregorian';

export const calendarFor = (locale: string): CalendarSystem =>
  locale === 'fa' ? 'jalali' : 'gregorian';

const lib = (system: CalendarSystem) => (system === 'jalali' ? jalali : gregorian);
// Iranian weeks start on Saturday; English UI uses Sunday.
const weekStartsOn = (system: CalendarSystem) => (system === 'jalali' ? 6 : 0) as 0 | 6;

export const startOfMonth = (date: Date, system: CalendarSystem) => lib(system).startOfMonth(date);
export const endOfMonth = (date: Date, system: CalendarSystem) => lib(system).endOfMonth(date);
export const addMonths = (date: Date, amount: number, system: CalendarSystem) =>
  lib(system).addMonths(date, amount);
export const isSameMonth = (a: Date, b: Date, system: CalendarSystem) =>
  lib(system).isSameMonth(a, b);
export const isSameDay = (a: Date, b: Date) => gregorian.isSameDay(a, b);
export const startOfDay = (date: Date) => gregorian.startOfDay(date);

/** Weeks (rows of 7 days) covering the whole month of `anchor`, padded with adjacent days. */
export function monthGrid(anchor: Date, system: CalendarSystem): Date[][] {
  const f = lib(system);
  const first = f.startOfWeek(f.startOfMonth(anchor), { weekStartsOn: weekStartsOn(system) });
  const last = f.endOfWeek(f.endOfMonth(anchor), { weekStartsOn: weekStartsOn(system) });
  const days = gregorian.eachDayOfInterval({ start: first, end: last });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

const intlLocale = (locale: string) => (locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US');

export const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(date);

export const dayLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric' }).format(date);

export const weekdayLabels = (week: Date[], locale: string) =>
  week.map((d) => new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short' }).format(d));

/** Local calendar day → ISO string at local midnight (what date pickers send to the API). */
export const toDayIso = (date: Date) => startOfDay(date).toISOString();
