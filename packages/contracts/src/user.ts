import type { ZodInstance } from './task';

/**
 * Email is opt-in per job kind, not per account only.
 *
 * The account-wide `notifyEmail` switch stays the master gate: these keys decide *which* mails
 * still land when it is on, so a user can keep due reminders but silence the daily digest.
 * In-app notifications are unaffected by either switch.
 */
export const EMAIL_NOTIFICATION_KINDS = ['digest', 'reminders', 'weekly'] as const;
export type EmailNotificationKind = (typeof EMAIL_NOTIFICATION_KINDS)[number];

/** EmailPreferences is an object literal type on purpose: Prisma's `InputJsonValue` has an index
 *  signature, which an `interface` would not satisfy. */
export type EmailPreferences = {
  digest: boolean;
  reminders: boolean;
  weekly: boolean;
};

/** Everything on, so an account that never touched the setting behaves exactly as before. */
export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  digest: true,
  reminders: true,
  weekly: true,
};

/**
 * Stored JSON → complete preferences.
 *
 * The column is nullable and hand-editable, so anything unrecognised (null, a string, a kind that
 * no longer exists) falls back to the default instead of throwing inside a background job.
 */
export function resolveEmailPreferences(stored: unknown): EmailPreferences {
  const source =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const resolved = { ...DEFAULT_EMAIL_PREFERENCES };
  for (const kind of EMAIL_NOTIFICATION_KINDS) {
    const value = source[kind];
    if (typeof value === 'boolean') resolved[kind] = value;
  }
  return resolved;
}

/** `emailPreferences` of `PATCH /users/me`: only the kinds present are changed. */
export const emailPreferencesSchema = (z: ZodInstance) =>
  z
    .object({
      digest: z.boolean(),
      reminders: z.boolean(),
      weekly: z.boolean(),
    })
    .partial()
    .strict();
