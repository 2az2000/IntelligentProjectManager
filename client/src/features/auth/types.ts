/** Mirrors UserDto in docs/02-API-CONTRACT.md */
export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  theme: string | null;
}
