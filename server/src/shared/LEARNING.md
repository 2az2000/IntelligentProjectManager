# درس‌نامه‌ی `shared/` — زیرساخت مشترک

## `http/handle.ts` — الگوی مرکزی validation ⭐

بیشترین چیزی که از این ریپو یاد می‌گیری در ~۲۰ خط کد این فایل است:

```ts
handle({ body: createTaskBody }, async ({ body }, req, res) => { ... })
```

- **چه می‌کند؟** ورودی‌های `params/query/body` را با Zod `parse` می‌کند؛ خروجی **تایپ‌دار** است و دیگر هیچ `req.body as ...` در ریپو نداری.
- **خطا کجا می‌رود؟** ZodError پرتاب می‌شود → Express 5 promiseهای ردشده را خودش به error handler می‌فرستد → [error-handler.ts](http/error-handler.ts) آن را به `400 VALIDATION_ERROR` ترجمه می‌کند.
- **چه زمانی مشابهش را می‌خواهی؟** هر APIای که ورودی کاربر می‌گیرد. «Validate در مرز، اعتماد در داخل» — بعد از handle، سرویس‌ها دیگر validate نمی‌کنند.

## `http/error-handler.ts` — ترجمه‌ی خطا

نکته‌ی کلیدی: خطاهای شناخته‌شده (`AppError`، `ZodError`، خطاهای Prisma مثل P2002 unique) به کد/استاتوس مشخص map می‌شوند؛ هر چیز ناشناخته → `500 INTERNAL_ERROR` با لاگ کامل. پاسخ همیشه `{error: {code, message, details, requestId}}` است — کلاینت روی همین قرارداد (`ApiError` در `api-client.ts`) بنا شده.

## `errors/` — سلسله‌مراتب خطا

`AppError(status, code, message)` پایه است؛ `ValidationError/UnauthorizedError/ForbiddenError/NotFoundError/ConflictError` زیرکلاس‌هایش. تمرین: چرا `assertRole` در projects برای غیرعضو **404** برمی‌گرداند نه 403؟ (پاسخ در کامنت سرویس: افشا نشدن وجود پروژه‌ی دیگران.)

## `auth/tokens.ts` و `auth/require-auth.ts` — JWT + کوکی

- **access token**: JWT HS256 با `sub=userId` و TTL کوتاه (پیش‌فرض ۱۵ دقیقه) در کوکی httpOnly `access_token`.
- **refresh token**: رشته‌ی تصادفی ۲۵۶بیتی (نه JWT!) — فقط **HMAC** آن در DB ذخیره می‌شود؛ یعنی لو رفتن دیتابیس = لو رفتن توکن‌ها نیست.
- `verifyAccessToken` به‌جای throw، union type `{ok:true}|{ok:false,reason}` برمی‌گرداند — الگوی خوب برای کد حساس.

## `realtime/bus.ts` — publish/subscribe درون-پروسه‌ای

`EventEmitter` تایپ‌دار: سرویس‌ها `publish('task:changed', payload)` می‌کنند و Socket.IO (که در `realtime/server.ts` subscribe شده) به roomها می‌فرستد. چرا bus جدا؟ چون سرویس‌ها نبایدSocket.IO را بشناسند — در تست‌ها هم هیچ subscriberای نیست و publish بی‌اثر می‌شود.

## `db/prisma.ts`، `logger.ts`

- `Db` تایپ زیرمجموعه‌ای از PrismaClient است؛ همه‌ی ماژول‌ها به آن وابسته‌اند، نه به singleton واقعی — برای همین تست‌ها DB واقعی ولی از طریق همان interface می‌گیرند.
- pino با request id؛ در تست‌ها سطح لاگ پایین است (بگرد ببین کجا).

## تمرین

1. یک schema Zod بنویس که `tags` را از رشته‌ی «a,b,c» به آرایه تبدیل کند (`.transform`) و در handle استفاده کن.
2. در `error-handler.ts` یک map برای `P2025` (record not found در Prisma) پیدا کن و ببین چه استاتوسی می‌گیرد.
