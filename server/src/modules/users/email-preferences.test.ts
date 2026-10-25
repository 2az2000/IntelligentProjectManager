import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_PREFERENCES, resolveEmailPreferences } from '@managesys/contracts';

/**
 * The column is nullable and hand-editable, and these values are read inside background jobs.
 * A bad value must degrade to the default, never throw mid-digest.
 */
describe('resolveEmailPreferences', () => {
  it('reads a never-touched account as all-on', () => {
    expect(resolveEmailPreferences(null)).toEqual(DEFAULT_EMAIL_PREFERENCES);
    expect(resolveEmailPreferences(undefined)).toEqual({ digest: true, reminders: true, weekly: true });
  });

  it('keeps the booleans it knows and ignores the rest', () => {
    expect(resolveEmailPreferences({ digest: false, reminders: true })).toEqual({
      digest: false,
      reminders: true,
      weekly: true,
    });
    expect(resolveEmailPreferences({ weekly: false, unknown: false })).toEqual({
      digest: true,
      reminders: true,
      weekly: false,
    });
  });

  it('falls back to defaults for values that are not booleans', () => {
    expect(resolveEmailPreferences({ digest: 'no', weekly: 1 })).toEqual(DEFAULT_EMAIL_PREFERENCES);
    expect(resolveEmailPreferences('not-json')).toEqual(DEFAULT_EMAIL_PREFERENCES);
    expect(resolveEmailPreferences([false])).toEqual(DEFAULT_EMAIL_PREFERENCES);
  });
});
