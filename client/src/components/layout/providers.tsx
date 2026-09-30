'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Direction } from 'radix-ui';
import { useLocale } from 'next-intl';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { makeQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const locale = useLocale();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {/* Radix primitives (menus, selects, sheets) need the text direction explicitly. */}
        <Direction.DirectionProvider dir={locale === 'fa' ? 'rtl' : 'ltr'}>
          <TooltipProvider>
            {children}
            <Toaster richColors position={locale === 'fa' ? 'bottom-left' : 'bottom-right'} />
          </TooltipProvider>
        </Direction.DirectionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
