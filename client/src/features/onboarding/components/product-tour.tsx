'use client';

import { useEffect, useRef } from 'react';
import 'driver.js/dist/driver.css';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/features/auth';
import { useUpdateProfile } from '@/features/users';

/**
 * §4 onboarding — a five-step tour shown once per account (server-stamped `onboardedAt`, so it
 * follows the user across browsers). Steps target elements the board has already rendered; the
 * whole thing is client-only, so nothing here runs on the server.
 */
export function ProductTour() {
  const t = useTranslations('Tour');
  const { data: me } = useCurrentUser();
  const update = useUpdateProfile();
  const started = useRef(false);

  useEffect(() => {
    // The flag is the server's; the ref only protects against StrictMode's double mount.
    if (!me || me.onboardedAt !== null || started.current) return;
    started.current = true;

    const finish = () =>
      update.mutate({ onboardedAt: new Date().toISOString() }, { onError: () => undefined });

    const timer = window.setTimeout(async () => {
      const steps = [
        { element: '[data-tour="search"]', title: t('searchTitle'), description: t('searchBody') },
        { element: '[data-tour="filters"]', title: t('filtersTitle'), description: t('filtersBody') },
        { element: '[data-tour="new-task"]', title: t('createTitle'), description: t('createBody') },
        { element: '[data-tour="board"]', title: t('boardTitle'), description: t('boardBody') },
        { element: '[data-tour="shortcuts"]', title: t('keysTitle'), description: t('keysBody') },
      ].filter((step) => document.querySelector(step.element) !== null);
      if (steps.length === 0) return;

      // Loaded lazily: driver.js touches `window` at import time, so it must stay off the server.
      const { driver } = await import('driver.js');
      driver({
        showProgress: true,
        allowClose: true,
        overlayColor: 'rgba(15, 23, 42, 0.65)',
        nextBtnText: t('next'),
        prevBtnText: t('prev'),
        doneBtnText: t('done'),
        // driver.js substitutes these placeholders itself — ICU would reject the braces.
        progressText: `${t('progressLabel')} {{current}}/{{total}}`,
        steps,
        onDestroyed: finish,
      }).drive();
    }, 700);

    return () => window.clearTimeout(timer);
    // Starts once per account; the toast/translation identities do not affect the steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.onboardedAt]);

  return null;
}
