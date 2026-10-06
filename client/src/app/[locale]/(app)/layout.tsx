import { Suspense, type ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { AuthGuard } from '@/features/auth';
import { TaskSheet } from '@/features/tasks';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 flex-col border-e bg-muted/40 md:flex">
          <Sidebar />
        </aside>
        <main id="main-content" className="flex-1 overflow-y-auto">{children}</main>
      </div>
      {/* Task details open from any page via ?task=<id> */}
      <Suspense>
        <TaskSheet />
      </Suspense>
    </AuthGuard>
  );
}
