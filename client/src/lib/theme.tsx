'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { THEME_STORAGE_KEY } from './theme-key';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export { THEME_STORAGE_KEY };

const DARK_MEDIA = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  /** What the user picked; `system` follows the OS. */
  theme: Theme;
  /** What is actually painted right now (`system` resolved against the OS). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

/** Drop-in replacement for `next-themes`'s `useTheme` (no script tag, no client warning). */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

function storedTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Private mode / blocked storage — fall back to following the system.
  }
  return 'system';
}

// ---- the "system" media query as an external store --------------------------

const darkListeners = new Set<() => void>();

function subscribeDark(onChange: () => void): () => void {
  darkListeners.add(onChange);
  const media = window.matchMedia(DARK_MEDIA);
  media.addEventListener('change', onChange);
  return () => {
    darkListeners.delete(onChange);
    media.removeEventListener('change', onChange);
  };
}

const isDark = (): boolean => window.matchMedia(DARK_MEDIA).matches;

/**
 * Tailwind's dark variant keys off `.dark` on the root; `color-scheme` styles native controls.
 * Transitions are suppressed for one frame, otherwise every themed surface animates at once and
 * the switch looks like a flash.
 */
function paint(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  const freeze = document.createElement('style');
  freeze.appendChild(document.createTextNode('*,*::before,*::after{transition:none!important}'));
  document.head.appendChild(freeze);

  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  // Reading a computed style forces the recalc, so removing the rule can't be batched away.
  window.getComputedStyle(document.body);
  setTimeout(() => freeze.remove(), 0);
}

/**
 * Theme state lives outside React (localStorage + the OS preference), so it is read with
 * `useSyncExternalStore` rather than mirrored into state by an effect. The *first* paint is done
 * by the blocking `<ThemeScript />` on the server; this only keeps up with later changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeDark, snapshotOf, () => 'system|light');
  const [theme, system] = snapshot.split('|') as [Theme, ResolvedTheme];
  const resolvedTheme: ResolvedTheme = theme === 'system' ? system : theme;

  // Painting the DOM is an external-system update, which is what effects are for.
  useEffect(() => {
    paint(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just won't survive a reload.
    }
    // `storage` only fires in *other* tabs, so subscribers are told directly here.
    darkListeners.forEach((notify) => notify());
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * One string for both axes, because `useSyncExternalStore` compares snapshots by identity and a
 * freshly built object would report a change on every render.
 */
function snapshotOf(): string {
  return `${storedTheme()}|${isDark() ? 'dark' : 'light'}`;
}
