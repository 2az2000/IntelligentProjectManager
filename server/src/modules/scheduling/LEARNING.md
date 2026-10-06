# درس‌نامه‌ی `modules/scheduling` — CPM و مسیر بحرانی

بهترین جای ریپو برای یادگیری **الگوریتم روی گراف** در یک مسئله‌ی واقعی.

## نقشه‌ی پوشه

- `domain/graph.ts` — ساخت گراف از `TaskDependency` (edgeهای FINISH_TO_START بین تسک‌های top-level).
- `domain/dependency-resolver.ts` — تشخیص cycle و شمارش ورودی‌ها؛ چرا مهم است؟ چون افزودن وابستگیِ حلقه‌ای باید همان لحظه 409 `DEPENDENCY_CYCLE` بدهد نه بعداً schedule را خراب کند.
- `domain/critical-path.ts` — **CPM کلاسیک**: عبور forward (`earliestStart/earliestFinish`) و backward (`latestStart/latestFinish`)؛ `slack = latestStart - earliestStart`؛ تسک با slack صفر عضو **مسیر بحرانی** است.
- `application/schedule.ts` — تابع `buildSchedule`: گراف + تخمین‌ها → `ScheduleResult` (خالص، تست‌پذیر). تسک‌های بدون `estimateHours` در محاسبه شرکت نمی‌کنند و در `unestimatedTaskIds` برمی‌گردند.
- `application/scheduling.service.ts` — دسترسی (همان الگوی assertRole) + اعمال تاریخ‌ها با `apply` روی فیلدهای خالی تسک‌ها.

## درس‌های فراتر از الگوریتم

1. **تقویم کاری**: `WORKING_WEEKEND` (پیش‌فرض پنجشنبه/جمعه — ایران) در `config/env.ts`؛ تبدیل «۲۴ ساعت کار» به «تاریخ شروع/پایان» با پرش از آخر هفته‌ها. الگوریتم‌های زمانی را از تقویم جدا نگه دار — این فایل‌ها نمونه‌ی جداسازی‌اند.
2. **خوانایی خروجی**: `ScheduleResult` شامل هم محاسبات خام (slack, isCritical) هم تاریخ‌های قابل نمایش (`scheduledStart/Finish`) است؛ DTO سرِ کلاینت هیچ محاسبه‌ای تکرار نمی‌کند.
3. **endpoint درست**: `GET /projects/:id/schedule` محاسبه‌ی بی‌اثر است؛ `POST .../schedule/apply` ثبت می‌کند — تفکیک «پیش‌نمایش» از «اعمال» که بعداً در ماژول AI هم همان اصل را می‌بینی.

## تمرین‌ها

1. روی کاغذ برای گراف A→B→C و A→D→C، ES/EF/LS/LF و slack هر گره را دستی حساب کن؛ بعد با تست‌های `critical-path.test.ts` چک کن.
2. تست بنویس: افزودن وابستگی‌ای که تسک DONE را پیش‌نیاز قرار دهد چه اتفاقی می‌افتد؟ (راهنمایی: تصمیم محصولی بگیر و در service پیاده کن.)
3. چرا dependency فقط بین تسک‌های **top-level** مجاز است؟ پاسخ را در resolver/schema پیدا کن.
