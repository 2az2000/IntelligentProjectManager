import {
  resolveEmailPreferences,
  type EmailPreferences,
} from '@managesys/contracts';

export const LOCALES = ['fa', 'en'] as const;
export const THEMES = ['light', 'dark', 'system'] as const;

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  theme: string | null;
  notifyEmail: boolean;
  /** §2.1 stored JSON (`{digest, reminders, weekly}`); read through `emailPreferencesOf`. */
  emailPreferences: unknown;
  /** §4 onboarding: set when the first-run tour was finished or skipped. */
  onboardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileChanges {
  name?: string;
  avatarUrl?: string | null;
  locale?: (typeof LOCALES)[number];
  theme?: (typeof THEMES)[number] | null;
  notifyEmail?: boolean;
  /** §2.1 partial update: the service merges it with the stored value before writing. */
  emailPreferences?: Partial<EmailPreferences>;
  onboardedAt?: Date | null;
}

export interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface UserDto {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  theme: string | null;
  notifyEmail: boolean;
  /** §2.1 always complete (defaults filled in), so the client renders every switch. */
  emailPreferences: EmailPreferences;
  onboardedAt: string | null;
}

export interface UserSummaryDto {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/** Stored JSON → complete switches. Shared with the mail jobs so they read it the same way. */
export const emailPreferencesOf = (user: { emailPreferences: unknown }): EmailPreferences =>
  resolveEmailPreferences(user.emailPreferences);

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  locale: user.locale,
  theme: user.theme,
  notifyEmail: user.notifyEmail,
  emailPreferences: emailPreferencesOf(user),
  onboardedAt: user.onboardedAt?.toISOString() ?? null,
});
