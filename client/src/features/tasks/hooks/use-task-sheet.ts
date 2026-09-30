'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Opens/closes the task detail sheet through the `?task=<id>` query parameter, so the
 * open task survives reloads and can be shared as a link. Reads `window.location` at call
 * time to avoid useSearchParams (which would force Suspense boundaries on static pages).
 */
export function useTaskSheet() {
  const router = useRouter();
  const pathname = usePathname();

  const setTask = useCallback(
    (taskId: number | null) => {
      const params = new URLSearchParams(window.location.search);
      if (taskId === null) params.delete('task');
      else params.set('task', String(taskId));
      router.replace({ pathname, query: Object.fromEntries(params) }, { scroll: false });
    },
    [router, pathname],
  );

  return {
    openTask: useCallback((taskId: number) => setTask(taskId), [setTask]),
    closeTask: useCallback(() => setTask(null), [setTask]),
  };
}
