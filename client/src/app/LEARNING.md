# درس‌نامه‌ی `src/app/` — App Router، i18n و PWA

## ساختار route

```
app/
├── proxy.ts                 ← proxy (middleware) — ریدایرکت locale و گارد auth
├── globals.css              ← Tailwind 4 + design tokens (theme)
├── manifest.ts              ← PWA manifest به‌صورت متادیتا
└── [locale]/                ← سگمنت داینامیک زبان (fa | en)
    ├── layout.tsx           ← <html dir>، فونت‌ها، NextIntlClientProvider، Providers
    ├── not-found.tsx
    ├── (auth)/              ← route group بدون اثر در URL: /login, /register
    └── (app)/               ← صفحات لاگین‌شده: dashboard, projects, tasks, ...
```

**درس‌های کلیدی:**

1. **`generateStaticParams`** در [layout.tsx](%5Blocale%5D/layout.tsx) دو locale را از قبل رندر می‌کند — ترکیب SSG با سگمنت داینامیک.
2. **`params` در Next 15+ یک Promise است**: `const {locale} = await params` — API جدید را همین‌جا ببین. `hasLocale` + `notFound()` یعنی locale نامعتبر → 404 تمیز.
3. **`dir={locale === 'fa' ? 'rtl' : 'ltr'}`**: RTL سطح سند است؛ کامپوننت‌ها فقط باید با marginهای منطقی (`ms/me/ps/pe`) بنویسند تا هر دو جهت کار کنند.
4. **`(auth)` و `(app)`**: route group‌ها URL را تغییر نمی‌دهند ولی اجازه می‌دهند هر گروه layout/برگه‌ی متفاوت بگیرند — الگوی استاندارد جداسازی صفحات مهمان از اپ.
5. **Server Component پیش‌فرض** است و این layout هم async است؛ اما صفحات داخلش تقریباً همه `'use client'` هستند (چرا؟ به [LEARNING.md](../LEARNING.md) ریشه‌ای برگرد: realtime + optimistic).

## proxy.ts (middleware)

در Next 16 فایل `proxy.ts` همان نقش `middleware.ts` قدیم را دارد. کارش: تشخیص locale از cookie/هدر و ریدایرکت به مسیر پیشونددار (`/fa/...`). با `next-intl/middleware` چندخطی شده — ولی هر خط را بفهم: matcher چه مسیرهایی را می‌گیرد و چرا statics مستثنا هستند.

## PWA

- `manifest.ts` — Web App Manifest از کد (نه فایل JSON ثابت) با `MetadataRoute.Manifest`.
- `components/pwa/` — `register-sw.ts` سرویس‌ورکر را بعد از load ثبت می‌کند و `sw.js` + `offline.html` در `public/` هستند: کش network-first برای اپ و fallback آفلاین. درس: حداقل PWA = manifest + SW + fallback؛ هیچ کتابخانه‌ای لازم نیست.

## تمرین‌ها

1. مسیر `/fa/projects` را باز کن و در DevTools تب Network ببین چه چیزی SSR شده و چه چیزی بعداً با axios گرفته شده — مرز Server/Client را روی صفحه واقعی لمس کن.
2. یک route group جدید `(public)` با صفحه‌ی about بساز؛ مطمئن شو خارج از گارد auth است.
3. `not-found.tsx` را فارسی/انگلیسی ببین — `useTranslations` در Client Component چطور کار می‌کند؟ (NextIntlClientProvider در layout.)
