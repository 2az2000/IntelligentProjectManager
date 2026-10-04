import { describe, expect, it } from 'vitest';
import { addWorkingHours, isWorkingDay, parseWeekend } from './work-calendar';

// 2026-09-30 is a Wednesday; 10-02 Friday and 10-03 Saturday under a Thu/Fri weekend.
const WEDNESDAY_10 = new Date('2026-09-30T10:00:00.000Z');
const THURSDAY_10 = new Date('2026-10-01T10:00:00.000Z');
const FRIDAY_10 = new Date('2026-10-02T10:00:00.000Z');
const IRANIAN_WEEKEND = parseWeekend('THURSDAY,FRIDAY');

describe('parseWeekend', () => {
  it('parses the Iranian weekend default', () => {
    expect([...IRANIAN_WEEKEND].sort()).toEqual([4, 5]); // Thu, Fri
  });

  it('ignores unknown names and empty specs', () => {
    expect(parseWeekend('SOMEDAY,FRIDAY')).toEqual(new Set([5]));
    expect(parseWeekend('')).toEqual(new Set());
  });
});

describe('isWorkingDay', () => {
  it('flags Thursday and Friday, keeps Saturday', () => {
    expect(isWorkingDay(THURSDAY_10, IRANIAN_WEEKEND)).toBe(false);
    expect(isWorkingDay(FRIDAY_10, IRANIAN_WEEKEND)).toBe(false);
    expect(isWorkingDay(new Date('2026-10-03T10:00:00.000Z'), IRANIAN_WEEKEND)).toBe(true);
  });

  it('counts every day with an empty weekend', () => {
    expect(isWorkingDay(FRIDAY_10, new Set())).toBe(true);
  });
});

describe('addWorkingHours', () => {
  it('adds hours across a working day normally', () => {
    expect(addWorkingHours(WEDNESDAY_10, 8, IRANIAN_WEEKEND).toISOString()).toBe('2026-09-30T18:00:00.000Z');
  });

  it('skips the Thu/Fri weekend when crossing days', () => {
    // Wednesday 10:00 + 16h: 13 working hours on Wed (11:00–23:00), Thu/Fri skipped,
    // then 3 hours on Saturday ⇒ Sat 02:00.
    expect(addWorkingHours(WEDNESDAY_10, 16, IRANIAN_WEEKEND).toISOString()).toBe('2026-10-03T02:00:00.000Z');
  });

  it('rolls a zero-duration weekend start forward to the next working day', () => {
    expect(addWorkingHours(FRIDAY_10, 0, IRANIAN_WEEKEND).toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });

  it('with an empty weekend behaves like plain calendar hours', () => {
    expect(addWorkingHours(WEDNESDAY_10, 16, new Set()).toISOString()).toBe('2026-10-01T02:00:00.000Z');
  });

  it('never consumes hours on weekend days even mid-range', () => {
    // Wednesday 22:00 + 3h: 23:00 Wed (1h), Thu/Fri skipped, Sat 00:00+2h ⇒ Sat 01:00.
    expect(addWorkingHours(new Date('2026-09-30T22:00:00.000Z'), 3, IRANIAN_WEEKEND).toISOString()).toBe(
      '2026-10-03T01:00:00.000Z',
    );
  });
});
