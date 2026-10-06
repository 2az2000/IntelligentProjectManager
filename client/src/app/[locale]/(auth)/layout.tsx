import { Suspense, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ModeToggle } from '@/components/layout/mode-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex justify-end gap-1 p-4">
        <Suspense>
          <LocaleSwitcher />
        </Suspense>
        <ModeToggle />
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 pb-16">{children}</main>
    </div>
  );
}
