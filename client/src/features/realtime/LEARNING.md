# درس‌نامه‌ی `features/realtime` — Socket.IO در React

## singleton سوکت

[socket.ts](socket.ts): `getRealtimeSocket()` یک سوکت به‌ازای هر تب می‌سازد (ماژول-لِوِل متغیر). نکته‌ها:

- احراز هویت با **همان کوکی** (`withCredentials`) — هیچ توکن جداگانه‌ای برای socket نیست.
- پشتیبانی از دو حالت API: مطلق (`http://localhost:8000`) یا نسبی (`/api` پشت proxy) — با `path` متفاوت. این در deployment واقعی (هم‌دامنه) لازم شد؛ کامنت‌های فایل را بخوان.
- `typeof window === 'undefined'` یعنی در SSR سوکتی نساز (در سرور Node معنا ندارد).

## الگوی اتصال به React

هوک‌های فیچر (مثل `use-task-events`) با `useEffect` subscribe می‌شوند و در cleanup unsubscribe — هر رندر اضافی نشتی listener نمی‌گذارد. داخل هندلر معمولاً یک کار می‌کنیم: **invalidate کردن queryهای مربوطه** (`qk.tasks.byProject(...)`) تا TanStack Query خودش بازبخواند.

**اصل مهم:** realtime، state جدید نمی‌آورد؛ خبر می‌دهد که cache کهنه شده. تک‌منبع حقیقت همچنان سرور + query cache.

## rooms سمت سرور

`user:<id>` خصوصی (اعلان‌ها) و `project:<id>` (رویدادهای تسک/کامنت و presence). سمت کلاینت با `socket.emit('project:join', ...)` عضو می‌شویم. قرارداد eventها در `socket.ts` تایپ شده و **آینه‌ی** `server/src/shared/realtime/bus.ts` است — دو طرف را همیشه باهم آپدیت کن.

## تمرین‌ها

1. دو مرورگر، دو کاربر، همان پروژه: در یکی تسک را جابه‌جا کن و ببین دیگری بدون رفرش آپدیت می‌شود؛ در DevTools تب Network → WS فریم‌ها را ببین.
2. در هندلر `task:changed` به‌جای invalidate، `setQueryData` دستی بنویس؛ به مزایا/ریسک‌ها (تضاد با optimistic) فکر کن.
