# درس‌نامه‌ی `modules/auth` — احراز هویت واقعی با JWT و refresh rotation

> پیش‌نیاز: [shared/LEARNING.md](../../shared/LEARNING.md) (الگوی handle و AppError)

## فایل‌ها و نقش هرکدام

| فایل | نقش | نکته‌ی آموزشی |
|------|-----|----------------|
| [auth.routes.ts](auth.routes.ts) | register/login/refresh/logout/change-password/me | نازک‌ترین لایه: فقط validate → سرویس → کوکی → پاسخ |
| [auth.service.ts](auth.service.ts) | قواعد احراز هویت | هیچ چیزِ Express نمی‌داند؛ `clock` تزریقی دارد |
| [refresh-token.repository.ts](refresh-token.repository.ts) | دسترسی به جدول RefreshToken | الگوی repository در ساده‌ترین شکل |
| [password.ts](password.ts) | hash/verify با argon2 | هرگز پسورد خام ذخیره/لاگ نمی‌شود |
| [auth.cookies.ts](auth.cookies.ts) | ست/پاک کردن کوکی‌ها | httpOnly، sameSite، secure در prod |
| [auth.schemas.ts](auth.schemas.ts) | Zod bodies | export شدن برای OpenAPI — داکیومنت با کد یکی است |

## درس اصلی ۱: چرا دو توکن؟

- **Access token** (JWT، ۱۵ دقیقه): هر درخواست همراه است؛ کوچک و stateless. چون کوتاه‌عمر است، سرقتش آسیب کمی دارد.
- **Refresh token** (رشته‌ی تصادفی، ۷ روز): فقط برای گرفتن access جدید. در DB ذخیره می‌شود تا **قابل revoke** باشد (stateful عمداً).

توازن کلاسیک: امنیت (TTL کوتاه) در برابر تجربه‌ی کاربر (لاگین نماندن) — refresh این دو را آشتی می‌دهد.

## درس اصلی ۲: rotation با reuse detection 🔐

به `refresh()` در [auth.service.ts](auth.service.ts) دقت کن — این پیچیده‌ترین و ارزشمندترین تابع ماژول است:

1. هر refresh token **یک‌بارمصرف** است: مصرف → revoke → توکن جدید از همان `familyId`.
2. اگر توکنِ *قبلاً revoke شده* دوباره بیاید یعنی احتمالاً توکن دزدیده شده → **کل خانواده revoke می‌شود** و کاربر لاگ‌اوت می‌شود.
3. پنجره‌ی ۱۵ ثانیه‌ای (`ROTATION_GRACE_MS`) برای race دو تب همزمان — دقت کن که «ری‌استفاده در پنجره‌ی کوتاه» بی‌خطر فرض می‌شود ولی ری‌استفاده‌ی دیرهنگام بحرانی. این تشخیص ریسک را ببین: `won = revokeIfActive(...)` یک atomic شرط در DB است تا دو درخواست همزمان هر دو برنده نشوند.

**چرا HMAC توکن در DB؟** `hashRefreshToken` با `JWT_REFRESH_SECRET` HMAC می‌گیرد. اگر DB لو برود، مهاجم توکن قابل‌ارائه ندارد؛ HMAC هم برگشت‌ناپذیر است.

## درس اصلی ۳: جزییات ظریف response

- `changePassword` بعد از تغییر رمز، **همه‌ی refreshهای کاربر را revoke** می‌کند و family جدید می‌سازد — خروج همه‌ی دستگاه‌های دیگر.
- `INVALID_CURRENT_PASSWORD` عمداً **400** است نه 401؛ 401 کلاینت را به سمت refresh می‌فرستد که اینجا بی‌معناست. (در کلاینت هم `settings-panel.tsx` همین کد را خاص هندل می‌کند.)
- در `refresh` route، روی خطا **کوکی‌ها پاک می‌شوند** (`clearAuthCookies`) — session مرده را زنده نگه ندار.
- limiter مخصوص credential endpoints (۲۰/۱۵دقیقه) جدا از limiter سراسری است: هرچه endpoint گران‌تر/حساس‌تر، بودجه‌ی تنگ‌تر.

## سینتکس‌های قابل یادگیری در این فایل‌ها

- `??=` و `??` (nullish) در `readRefreshCookie`
- `satisfies` در `tokens.ts` برای چک تایپ payload JWT
- override تزریق `clock: () => Date` برای تست‌پذیری زمان (دنبال استفاده‌اش در تست‌ها بگرد)
- factory pattern: `createAuthRouter(auth, users)` به‌جای کلاس روتر

## تمرین‌ها

1. مسیر کامل «لاگین → درخواست → 401 → refresh → تلاش مجدد» را روی کاغذ با نام توابع بکش؛ بعد همین را در کلاینت (`api-client.ts` interceptor) دنبال کن.
2. تست بنویس: ری‌استفاده‌ی refresh token بعد از گذشت grace window باید کل family را revoke کند (الگوی تست را از `tests/integration/auth.int.test.ts` بردار).
3. چرا `logout` بدون refresh token هیچ خطایی نمی‌دهد؟ (پاسخ: idempotent بودن — ایده‌آل برای فراخوانی تکراری UI.)
