# مسیر یادگیری ManageSys — سمت سرور 🎓

> این داکیومنت **نقشه‌ی شروع** است. از بالا به پایین بخوان و در هر ایستگاه فایل‌های واقعی را باز کن.
> هر ماژول یک `LEARNING.md` داخل خودش دارد — آموزش همان‌جاست که کد است.
>
> سمت کلاینت: [`client/LEARNING.md`](../client/LEARNING.md) · معماری رفرنس: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## این پروژه با چه چیزی ساخته شده؟

Express 5 + TypeScript + Prisma 7 + PostgreSQL + Redis/BullMQ + Socket.IO. ولی مهم‌تر از ابزارها، **سه تصمیم معماری** است که در همه‌جای کد تکرار می‌شوند و یادگیری آن‌ها ارزش اصلی این ریپوست:

1. **ماژول‌های مستقل با DI دستی** — هر ماژول یک تابع `createXModule({db, ...})` است که `{service, router}` برمی‌گرداند. هیچ فریم‌ورک DI‌ای در کار نیست؛ سیم‌کشی در یک نقطه اتفاق می‌افتد: `src/app.ts` (composition root).
2. **یک الگوی واحد برای همه‌ی endpointها** — `handle({body: schema}, handler)` با Zod ورودی را validate و تایپ‌دار می‌کند؛ خطاها همه از خانواده‌ی `AppError` هستند و یک `errorHandler` مرکزی به JSON استاندارد `{error: {code, message}}` تبدیلشان می‌کند.
3. **مرزهای لایه‌ای داخل هر ماژول** — `http/` (ورود و خروج HTTP) → `application/` (قواعد کسب‌وکار) → `infrastructure/` (Prisma) و `domain/` (entity خالص بدون وابستگی به Express یا Prisma).

## مسیر پیشنهادی یادگیری (به ترتیب)

| # | ایستگاه | چه چیزی یاد می‌گیری | داکیومنت |
|---|---------|---------------------|-----------|
| ۱ | `src/` | سفر یک request از `main.ts` تا پاسخ؛ composition root | [src/LEARNING.md](src/LEARNING.md) |
| ۲ | `shared/` | handle/Zod، errorها، JWT و cookie، realtime bus، logger | [src/shared/LEARNING.md](src/shared/LEARNING.md) |
| ۳ | `modules/users` + `modules/auth` | ساده‌ترین ماژول، بعد JWT/refresh rotation با reuse detection | [modules/auth/LEARNING.md](src/modules/auth/LEARNING.md) |
| ۴ | `modules/projects` | role-based access (OWNER→VIEWER)، قواعد عضویت | [modules/projects/LEARNING.md](src/modules/projects/LEARNING.md) |
| ۵ | `modules/tasks` | entity خالص + repository + fractional indexing | [modules/tasks/LEARNING.md](src/modules/tasks/LEARNING.md) |
| ۶ | `modules/scheduling` | CPM و مسیر بحرانی روی تقویم کاری | [modules/scheduling/LEARNING.md](src/modules/scheduling/LEARNING.md) |
| ۷ | `modules/activity`, `notifications`, `jobs` | هوک‌های awaited، Socket.IO، BullMQ و ایمیل | [modules/notifications/LEARNING.md](src/modules/notifications/LEARNING.md) |
| ۸ | `modules/ai` | سرویس AI با endpoint سازگار OpenAI (پیش‌نمایش، نه اجرا) | [modules/ai/LEARNING.md](src/modules/ai/LEARNING.md) |
| ۹ | `tests/` | تست integration با دیتابیس واقعی + فیکسچر | [tests/LEARNING.md](tests/LEARNING.md) |

## اجرا (چند دستور، بیشتر نه)

```bash
docker compose up -d          # Postgres روی پورت ۵۴۳۳ (طبق ریشه‌ی ریپو)
npm install
cp .env.example .env          # JWT secrets را پر کن (توضیح داخل فایل)
npx prisma migrate dev        # ساخت جداول
npm run db:seed               # admin@example.com / Admin@12345
npm run dev                   # سرور روی :8000 — Swagger در /docs
npx vitest run                # ۹۴ تست integration (global-setup خودش DB تست می‌سازد)
```

## تمرین‌های پیشنهادی (سخت‌تر شدن به‌تدریج)

1. **آسان:** endpoint‌ای به `users` اضافه کن که `notifyEmail` را برگرداند — فقط مسیر `handle` → service → repository را تمرین کن.
2. **متوسط:** فیلد `blockedAt` برای تسک اضافه کن: migration، تغییر entity، یک قانون در service و یک تست.
3. **چالش:** هوک `onChanged` را طوری گسترش بده که وقتی تسکی DONE شد، همه‌ی زیرتسک‌های باقی‌مانده‌اش در activity لاگ شوند.
4. **چالش AI:** در `modules/ai` قابلیت «برآورد ساعت برای همه‌ی تسک‌های بدون تخمین» را با همان الگوی preview-then-apply اضافه کن.
