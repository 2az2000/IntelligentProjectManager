/**
 * Shared by the server-rendered bootstrap script (`components/layout/theme-script.tsx`)
 * and the client provider (`lib/theme.tsx`). Lives on its own so neither has to import
 * the other across the server/client boundary.
 */
export const THEME_STORAGE_KEY = 'theme';
