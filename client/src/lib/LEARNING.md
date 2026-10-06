# درس‌نامه‌ی `src/lib/` — پل بین اپ و سرور

## `api-client.ts` — ارزشمندترین فایل کلاینت ⭐

سه درس بزرگ در یک فایل:

1. **Auth با کوکی، نه توکن در JS**: `withCredentials: true` و *هیچ* storage دستی — access/refresh در کوکی‌های httpOnly می‌مانند که XSS نمی‌تواند بخواندشان. هر جا دیدی کسی توکن را در localStorage می‌گذارد، این فایل را یادش بیاور.
2. **Refresh single-flight** (پایین فایل): interceptor روی 401: اگر endpoint خودِ auth نبود و قبلاً retry نشده بود، **یک** `POST /auth/refresh` برای همه‌ی 401های همزمان (`refreshInFlight ??=`) اجرا می‌شود، بعد درخواست اصلی دوباره زده می‌شود. `_retried` روی config جلوی حلقه‌ی بی‌نهایت را می‌گیرد.
3. **حالتهای مرزی**: `REFRESH_TOKEN_REUSED` یعنی تبِ دیگر همین الان چرخش کرده و کوکی جدید داریم — پس به‌جای لاگ‌اوت، retry. هر چیز دیگر → `onUnauthorized` listenerها (auth-guard به صفحه‌ی لاگین می‌برد).

همچنین `normalizeError` هر خطایی (axios/network/unknown) را به `ApiError{status, code, details}` یکدست می‌کند؛ بقیه‌ی اپ فقط با این تایپ کار می‌کنند.

## `query-keys.ts` — قرارداد cache

`qk.tasks.byProject(id)` و `qk.tasks.all` — الگوی **hierarchical keys** در TanStack Query: invalidate روی `qk.tasks.all` همه‌ی زیرکلیدها را باطل می‌کند. هر هوک جدید باید کلیدش را از همین فایل بگیرد؛ رشته‌ی خام در کامپوننت = باگ آینده.

## `i18n/` — next-intl

- `routing.ts` — `defineRouting({locales:['fa','en'], defaultLocale:'fa'})`؛ `Locale` type از همین‌جا.
- `navigation.ts` — `Link/useRouter/usePathname` نسخه‌ی locale-aware؛ **همیشه همین‌ها را import کن نه از next/navigation** وگرنه locale گم می‌شود.
- `request.ts` — بارگذاری messages سمت سرور.

## بقیه‌ی فایل‌ها

- `calendar.ts` — تبدیل‌های تاریخ شمسی/میلادی (`toDayIso` و ...)؛ توابع خالص با تست.
- `format.ts` — `formatNumber` با locale؛ اعداد فارسی/انگلیسی یکجا درست شوند.
- `utils.ts` — `cn()` (clsx+tailwind-merge): ترکیب کلاس‌ها با override درست — پایه‌ی همه‌ی کامپوننت‌های shadcn.

## تمرین‌ها

1. دو تب باز کن، در یکی لاگ‌اوت بزن، در دیگری درخواست بزن و مسیر 401→refresh→retry یا لاگ‌اوت را در console دنبال کن.
2. یک کلید query جدید برای «notifications count» اضافه کن و invalidate آن را در socket hook وصل کن.
