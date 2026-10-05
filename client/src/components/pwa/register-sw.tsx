'use client';

import { useEffect } from 'react';

/**
 * Registers the phase-6 PWA service worker (static caching + offline page)
 * in production builds only — no cache interference during development.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is best-effort; the app works fine without it.
      });
    };
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
