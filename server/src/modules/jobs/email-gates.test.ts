import { describe, expect, it } from 'vitest';
import { wantsEmail } from './jobs.module';

/**
 * §2.1 — the master switch and the per-kind switch are independent gates. A user who turned the
 * digest off must still get due reminders, and turning email off must silence all three kinds
 * without rewriting the stored choices.
 */
describe('wantsEmail', () => {
  const user = (notifyEmail: boolean, emailPreferences: unknown = null) => ({
    notifyEmail,
    emailPreferences,
  });

  it('sends nothing when the master switch is off', () => {
    const off = user(false, { digest: true, reminders: true, weekly: true });
    expect(wantsEmail(off, 'digest')).toBe(false);
    expect(wantsEmail(off, 'reminders')).toBe(false);
    expect(wantsEmail(off, 'weekly')).toBe(false);
  });

  it('treats a missing column as all-on', () => {
    const fresh = user(true, null);
    expect(wantsEmail(fresh, 'digest')).toBe(true);
    expect(wantsEmail(fresh, 'reminders')).toBe(true);
    expect(wantsEmail(fresh, 'weekly')).toBe(true);
  });

  it('honours a single kind without touching the others', () => {
    const quietDigest = user(true, { digest: false });
    expect(wantsEmail(quietDigest, 'digest')).toBe(false);
    expect(wantsEmail(quietDigest, 'reminders')).toBe(true);
    expect(wantsEmail(quietDigest, 'weekly')).toBe(true);
  });
});
