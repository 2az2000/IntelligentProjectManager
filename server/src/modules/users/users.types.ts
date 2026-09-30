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
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileChanges {
  name?: string;
  avatarUrl?: string | null;
  locale?: (typeof LOCALES)[number];
  theme?: (typeof THEMES)[number] | null;
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
}

export interface UserSummaryDto {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  locale: user.locale,
  theme: user.theme,
});
