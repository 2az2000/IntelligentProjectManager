'use client';

import { ErrorState } from '@/components/shared/error-state';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
