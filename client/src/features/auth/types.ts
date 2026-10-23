/** Mirrors UserDto in docs/02-API-CONTRACT.md */
export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  theme: string | null;
  /** Whether reminder/digest emails are delivered to this account. */
  notifyEmail: boolean;
  /** §4 first-run tour stamp (null = the tour has never been finished or skipped). */
  onboardedAt: string | null;
}
