# درس‌نامه‌ی `modules/users` — ساده‌ترین ماژول، بهترین نقطه‌ی شروع

قبل از auth برو سراغ این ماژول؛ همه‌ی اجزای معماری را در کوچک‌ترین مقیاس می‌بینی:

- [users.routes.ts](users.routes.ts) — دو endpoint: `GET /users?search=` (برای invite picker) و `PATCH /users/me` (ویرایش پروفایل خودش).
- [users.service.ts](users.service.ts) — منطق: نرمال‌سازی ایمیل (`normalizeEmail`)، جستجو با `contains` بی‌حساس به بزرگی حروف، ساخت کاربر با چک unique.
- [users.repository.ts](users.repository.ts) — کوئری‌های Prisma جدا از منطق.
- [users.types.ts](users.types.ts) — ⭐ **DTO pattern**: `toUserDto` مشخص می‌کند چه فیلدهایی از User بیرون می‌رود. دقت کن `passwordHash` و `email` (در بعضی viewها) هرگز لو نمی‌روند — خروجی API را *بنویس*، نگویید «همه به‌جز...».

## نکته‌های آموزشی

1. **`UserLookup` interface**: projects فقط `exists(userId)` می‌خواهد؛ ماژول users این قرارداد را satisfy می‌کند. یعنی وابستگی ماژول‌ها همیشه *کمینه* است (Interface Segregation).
2. **نرمال‌سازی در ورودی، نه در کوئری**: ایمیل قبل از ذخیره/جستجو lowercase می‌شود — قانون در یک نقطه.
3. سینتکس: `z.object(...).partial()` برای PATCH؛ `.strict()` برای رد کردن فیلدهای ناشناخته (ضد mass-assignment — تستش در `projects-tasks.int.test.ts` هست).

## تمرین

`PATCH /users/me` را بگرد: چرا کاربر نمی‌تواند `email` را اینجا تغییر دهد؟ اگر خواستی اضافه‌اش کنی، کجاها باید تغییر کند (schema؟ service؟ تست؟ ایمیلی که unique است چه خطایی می‌دهد؟)
