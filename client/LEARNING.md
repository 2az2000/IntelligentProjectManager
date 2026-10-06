# مسیر یادگیری ManageSys — سمت کلاینت 🎨

> نقشه‌ی شروع سمت Next.js. سمت سرور: [`server/LEARNING.md`](../server/LEARNING.md)
> رفرنس‌های خود پروژه: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) و [docs/CONVENTIONS.md](docs/CONVENTIONS.md)

## این پروژه با چه چیزی ساخته شده؟

Next.js 16 (App Router) + React 19 + TypeScript + TanStack Query 5 + Tailwind 4 + shadcn/ui + next-intl (فارسی پیش‌فرض، RTL) + Zustand و Socket.IO و MSW برای تست.

**نکته‌ی مهم آموزشی:** این پروژه تقریباً SPA درون App Router است — صفحات `'use client'` هستند و داده از طریق **TanStack Query + axios** می‌آید، نه Server Components data-fetching و نه Server Actions. چرا؟ چون realtime + به‌روزرسانی خوش‌بینانه‌ی Kanban قلب تجربه است. (اگر دنبال Server Action بودی، درس این ریپو عمداً برعکسش است؛ در [app/LEARNING.md](src/app/LEARNING.md) مقایسه شده.)

## مسیر پیشنهادی یادگیری (به ترتیب)

| # | ایستگاه | چه چیزی یاد می‌گیری | داکیومنت |
|---|---------|---------------------|-----------|
| ۱ | `src/app/` | App Router، layout با `[locale]`، proxy/middleware، PWA | [app/LEARNING.md](src/app/LEARNING.md) |
| ۲ | `src/lib/` + `src/i18n/` | axios interceptor با refresh single-flight، RTL، query keys | [lib/LEARNING.md](src/lib/LEARNING.md) |
| ۳ | `features/auth` | فرم RHF+Zod، auth-guard، جریان لاگین | [features/auth/LEARNING.md](src/features/auth/LEARNING.md) |
| ۴ | `features/projects` + `users` | data fetching با useQuery، invalidate، سطح دسترسی در UI | [features/projects/LEARNING.md](src/features/projects/LEARNING.md) |
| ۵ | `features/tasks` ⭐ | dnd-kit، **optimistic update**، dialog/sheet، زیرتسک، **دکمه‌ی AI** | [features/tasks/LEARNING.md](src/features/tasks/LEARNING.md) |
| ۶ | `features/realtime` | Socket.IO singleton، invalidate از سرور | [features/realtime/LEARNING.md](src/features/realtime/LEARNING.md) |
| ۷ | `features/settings` | چند فرم در یک صفحه + **کارت داکیومنت AI** | [features/settings/LEARNING.md](src/features/settings/LEARNING.md) |
| ۸ | `src/test/` | MSW + Testing Library — تست کامپوننت با سرور فیک | [test/LEARNING.md](src/test/LEARNING.md) |

## اجرا

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                    # :3000 — فارسی/RTL
npx vitest run --maxWorkers=1  # تست‌ها (ویندوز: تک‌ورکر اجباری)
```

سرور باید روی :8000 بالا باشد (به [`server/LEARNING.md`](../server/LEARNING.md) برگرد).

## قراردادهای کلیدی (قبل از هر کدی بخوان)

1. **ساختار feature-based**: هر فیچر پوشه‌ی `api/ hooks/ components/ schemas/ types.ts index.ts` دارد؛ import از بیرون فقط از `index.ts` barrel.
2. **قرارداد خطا**: همه‌چیز به `normalizeError` → `ApiError{status,code}` می‌رسد؛ پیام کاربر با `useErrorMessage` از `Errors.*` در messages فارسی می‌شود.
3. **i18n اجباری**: هیچ رشته‌ی UI مستقیم در کد نیست؛ `useTranslations('Tasks')` + کلیدهای `messages/{fa,en}.json`. for RTL از `me-*/ms-*/ps-*` استفاده کن نه `ml/mr/pl`.
4. **query keys مرکزی**: `src/lib/query-keys.ts` (`qk`) — تنها منبع حقیقت برای invalidate.
