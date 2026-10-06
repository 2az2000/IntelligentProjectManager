# درس‌نامه‌ی واکنش‌های جانبی — `activity` · `notifications` · `jobs` · `comments` · `attachments` · `dashboard`

این پنج‌تایی الگوی مشترکی دارند: «رکورد بنویس، بعد به دنیا خبر بده». تفاوت‌شان در *زمانِ* خبر دادن است — و همین، درس اصلی‌ست.

## جدول زمان‌بندی خبرها ⭐

| اتفاق | چه کسی خبر می‌دهد | چه زمانی | چرا |
|-------|------------------|----------|-----|
| تغییر تسک → activity row | `tasks.hooks.onChanged` در app.ts | **await** | رکورد باید قبل از پاسخ HTTP در timeline دیده شود |
| تغییر تسک → پیام socket | همان هوک | **sync بعد از await** | ارسال همزمانِ سریع؛ subscriber خطا هم request را نمی‌شکند |
| تغییر تسک → اعلان assignee | همان هوک | **await** (از `notifications.create`) | اعلانِ حذف‌نشده = تجربه‌ی بد |
| تغییر تسک → یادآوری ۲۴ساعت | `jobs.scheduleDueReminder` | **fire-and-forget** (`void`) | به صف Redis می‌رود؛ گیر Redis نباید API را ببندد |
| کامنت جدید → اعلان‌ها | `comments.hooks.onCreated` | **await** | همان منطق بالا |

این جدول را با [app.ts](../../app.ts) (بلاک هوک‌ها) و [notifications.module.ts](notifications.module.ts) (`create` در برابر `safeCreate`) تطبیق بده. قاعده‌ی سرانگشتی: **اثری که کاربر باید ببیند = awaited؛ اثری که می‌تواند دیر برسد = fire-and-forget.**

## `jobs` — صف واقعی با BullMQ

[jobs.module.ts](../jobs/jobs.module.ts):

- **scheduled job**: `repeat: {pattern: '0 8 * * *'}` برای خلاصه‌ی روزانه؛ `jobId` ثابت → dedupe خودکار در ری‌استارت.
- **delayed job**: `due-<taskId>` با `delay = dueDate - 24h - now`. هر تغییر تسک اول `queue.remove(jobId)` بعد در صورت لزوم add مجدد — الگوی **reconcile**: حالت صف همیشه بازتاب DB باشد.
- **degradation لطیف**: بدون Redis فقط warn می‌گیری، نه crash (`connection.on('error')` + `JOBS_ENABLED`) و در تست‌ها module به no-op تبدیل می‌شود. سرویس اختیاری را حتماً این‌طور بنویس.
- ایمیل در dev با `jsonTransport` (لاگ به‌جای SMTP) — بستر تست بدون سرور واقعی.

## `comments` — module در یک فایل

[comments.module.ts](../comments/comments.module.ts) همه‌چیز در یک فایل است و این *تصمیم* است نه سهل‌انگاری: ماژول کوچک حق دارد کوچک بماند. درس‌ها: **منشن‌ها** (`@Full Name` با تطبیق نام اعضا — heuristic ساده و صادقانه) و `assertTaskAccess` که از ماژول tasks فقط *دسترسی* می‌خواهد نه تسک.

## `attachments` و `dashboard` و `activity`

- attachments: آپلود multipart با محدودیت `MAX_UPLOAD_MB`، ذخیره‌ی دیسک و دانلود stream — نگاه کن چطور `storageKey` هرگز مستقیم به کلاینت مسیر واقعی نمی‌دهد.
- dashboard: نمونه‌ی **read model** — چند aggregate با `groupBy` در یک endpoint؛ هیچ state‌ای ندارد.
- activity: جدول append-only؛ هیچ updateای در کد نیست (audit trail واقعی).

## تمرین‌ها

1. زنجیره‌ی «تسک DONE شد» را کامل دنبال کن و بنویس چه چیزهایی در چه ترتیبی ثبت می‌شوند (activity؟ socket؟ اعلان؟ job؟).
2. یک نوع اعلان جدید (مثلاً `TASK_COMPLETED`) اضافه کن: schema؟ type union؟ i18n کلاینت؟ toast؟ — لیست جاهایی که باید دست بزنی خودش نقشه‌ی معماری است.
3. چرا `processReminder` قبل از ارسال، دوباره شرط‌ها را چک می‌کند (due moved away, DONE, project deleted)؟ در مورد صف‌های استال بنویس.
