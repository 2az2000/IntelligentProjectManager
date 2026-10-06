# درس‌نامه‌ی `modules/tasks` — بزرگ‌ترین ماژول، سه الگوی طلایی

ساختار: `domain/task.entity.ts` (entity خالص) · `application/task.service.ts` (قواعد + هوک) · `application/task.repository.ts` (قرارداد) · `infrastructure/prisma-task.repository.ts` (پیاده‌سازی) · `http/` (routes/schemas/dto) · [domain/position.ts](domain/position.ts) (ترتیب).

## درس ۱: entity خالص با متدهای دامنه

[task.entity.ts](domain/task.entity.ts) یک کلاس `Task` با `validateNew` / `applyChanges` / `toJSON` است — **نه** یک interface خالی. قواعد مثل «فقط تسک DONE تاریخ `completedAt` دارد» همین‌جا و بدون هیچ وابستگی‌ای تست می‌شوند. الگو: `Task.restore(row)` از ردیف DB entity می‌سازد و repository فقط همون entity را persist می‌کند. این وسطِ DDD است، بدون هیچ کتابخانه.

## درس ۲: fractional indexing ⭐

[domain/position.ts](domain/position.ts) را کامل بخوان — ۳۰ خط کد که مشکل کلاسیک «دو کاربر همزمان کارت جابه‌جا می‌کنند» را حل می‌کند:

- هر کارت float `position` دارد؛ جابه‌جایی یعنی نوشتن **یک عدد بین دو همسایه** (`before + (after-before)/2`)، نه بازنویسی کل ستون.
- وقتی فاصله از `MIN_POSITION_GAP` کمتر شود → `null` → سرویس **rebalance** می‌کند (شماره‌گذاری مجدد آن ستون با گام ۱۰۲۴) — کم و O(n) روی یک ستون.
- endpoint `/tasks/:id/move` فقط `status + beforeId/afterId` می‌گیرد؛ سرویس موقعیت جدید را محاسبه می‌کند. کلاینت هرگز position نمی‌فرستد.

## درس ۳: سرویس با هوک — قلب معماری

به `TaskService` نگاه کن:

- `hooks.onChanged` یک فیلد public قابل ست‌کردن است (قرارداد `TaskChangedHook` در بالای فایل). create/update/move/remove بعد از commit، `await this.fire(...)` می‌کنند؛ **app.ts** این هوک را به activity + realtime + notification وصل می‌کند. نتیجه: tasks هیچ شناختی از activity/notifications ندارد.
- `TRACKED_FIELDS` + `diffChanges` + snapshot قبل از `applyChanges`: diff دقیق (oldValue/newValue) برای activity log و پیام realtime ساخته می‌شود.
- «تغییر status با edit» کارت را به انتهای ستون جدید می‌برد (`lastPosition + STEP`) — تصمیم محصولی که در سرویس نه در route پیاده شده.

## دسترسی: دوباره 404 به‌جای 403

`list/get` با `assertRole(...,'VIEWER')` شروع می‌شوند. غیرعضو `PROJECT_NOT_FOUND` می‌گیرد — نه لیست خالی، نه 403. همان اصل «عدم افشای وجود منبع» که در projects دیدی.

## زیرتسک‌ها

`parentId` به خودِ Task اشاره می‌کند (self-relation در schema). زیرتسک همان Task است با `parentId` — مدل Todo جدا وجود ندارد؛ همین باعث شد در فاز ۷، AI بتواند «todo» پیشنهادش را با ساخت زیرتسک واقعی پیاده کند.

## تمرین‌ها

1. تست بنویس: دو move پشت‌سرهم بین همان دو همسایه → بعد از چند تکرار rebalance رخ دهد (threshold را با `MIN_POSITION_GAP` بازی کن).
2. چرا `update` اول `snapshot = task.toJSON()` می‌گیرد؟ اگر بعدش بگیری چه باگی می‌بینی؟
3. `myTasksRouter` (مسیر `/me/tasks`) را دنبال کن: فیلتر `assigneeId = من` کجا اعمال می‌شود؟
