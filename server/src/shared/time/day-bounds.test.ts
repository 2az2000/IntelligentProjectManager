import { describe, expect, it } from 'vitest';
import { calendarDaysBetween, dayBounds, endOfDayIn, startOfDayIn } from './day-bounds';

describe('startOfDayIn', () => {
  it('converts local midnight to its UTC instant (Tehran is +3:30)', () => {
    // 21:00Z on the 24th is already 00:30 on the 25th in Tehran.
    expect(startOfDayIn('Asia/Tehran', new Date('2026-10-24T21:00:00.000Z')).toISOString()).toBe(
      '2026-10-24T20:30:00.000Z',
    );
  });

  it('returns the same instant for every time inside that local day', () => {
    const morning = startOfDayIn('Asia/Tehran', new Date('2026-10-25T06:00:00.000Z'));
    const evening = startOfDayIn('Asia/Tehran', new Date('2026-10-25T18:00:00.000Z'));
    expect(morning.toISOString()).toBe('2026-10-24T20:30:00.000Z');
    expect(evening.toISOString()).toBe(morning.toISOString());
  });

  it('follows the zone across a DST transition', () => {
    // Europe/Berlin switches to summer time on 2026-03-29 at 02:00 (CET +1 → CEST +2).
    expect(startOfDayIn('Europe/Berlin', new Date('2026-03-29T12:00:00.000Z')).toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
    expect(endOfDayIn('Europe/Berlin', new Date('2026-03-29T12:00:00.000Z')).toISOString()).toBe(
      '2026-03-29T21:59:59.999Z',
    );
  });
});

describe('dayBounds', () => {
  it('brackets exactly one local day', () => {
    const { start, end } = dayBounds('Asia/Tehran', new Date('2026-10-25T06:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-10-24T20:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-25T20:29:59.999Z');
  });
});

describe('calendarDaysBetween', () => {
  it('counts midnights in the zone, not 24h windows', () => {
    const due = new Date('2026-10-23T21:00:00.000Z'); // 00:30 on the 24th in Tehran
    const now = new Date('2026-10-25T06:00:00.000Z'); // 09:30 on the 25th in Tehran
    expect(calendarDaysBetween(due, now, 'Asia/Tehran')).toBe(1);
    expect(calendarDaysBetween(due, now, 'UTC')).toBe(2);
  });

  it('is zero for any two instants in the same local day', () => {
    expect(
      calendarDaysBetween(
        new Date('2026-10-25T00:01:00.000Z'),
        new Date('2026-10-25T19:59:00.000Z'),
        'Asia/Tehran',
      ),
    ).toBe(0);
  });
});
