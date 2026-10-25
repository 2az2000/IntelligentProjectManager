import type { EmailPreferences } from '@managesys/contracts';

/** Mirrors UserDto in docs/02-API-CONTRACT.md */
export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  theme: string | null;
  /** Whether reminder/digest emails are delivered to this account (master switch). */
  notifyEmail: boolean;
  /** §2.1 which mails still go out while the master switch is on; always complete. */
  emailPreferences: EmailPreferences;
  /** §4 first-run tour stamp (null = the tour has never been finished or skipped). */
  onboardedAt: string | null;
}
