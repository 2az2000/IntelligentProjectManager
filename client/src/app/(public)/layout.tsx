import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Vazirmatn } from 'next/font/google';

import '../globals.css';

const vazirmatn = Vazirmatn({ variable: '--font-vazirmatn', subsets: ['arabic', 'latin'] });

export const metadata: Metadata = {
  title: 'ManageSys — سامانه هوشمند مدیریت پروژه',
  description:
    'مدیریت پروژه‌ی فارسی‌محور با زمان‌بندی CPM، پیش‌بینی مونت‌کارلو، دستیار هوش مصنوعی، ردیابی زمان و گزارش‌های تحلیلی — به‌همراه PWA آفلاین.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a1020',
};

/** Root layout for everything outside the app shell: one page, /landing. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body className="landing-body">{children}</body>
    </html>
  );
}
