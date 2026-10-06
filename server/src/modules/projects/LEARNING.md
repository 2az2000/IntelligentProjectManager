# درس‌نامه‌ی `modules/projects` — کنترل دسترسی مبتنی بر نقش

## مدل دسترسی در یک نگاه

`ProjectRole`: `OWNER > ADMIN > MEMBER > VIEWER` — [project-role.ts](domain/project-role.ts) با جدول رتبه `hasRole()` این را در ۶ خط پیاده می‌کند. هر endpoint قبل از هر کاری `assertRole(userId, projectId, حداقل نقش)` را صدا می‌زند:

- `VIEWER`: فقط خواندن
- `MEMBER`: ساخت/ویرایش تسک، کامنت
- `ADMIN`: مدیریت اعضا، ویرایش پروژه
- `OWNER`: حذف پروژه — و **هیچ‌کس owner را ادیت نمی‌کند**

## قواعد عضویت — domain خالص

[membership-rules.ts](domain/membership-rules.ts) یک تابع خالص است (`checkMembershipChange`) که هیچ DB و Expressی نمی‌شناسد: فقط `{actorRole, actorIsTarget, targetRole, newRole}` می‌گیرد و مجاز/غیرمجاز برمی‌گرداند. چرا این‌قدر تمیز؟ چون می‌شود برایش جدول تست کاور کامل نوشت بدون یک mock. این الگو را «decision function» می‌گویند — منطق تصمیم را از اثر جانبی جدا کن.

## `skills` اعضا و ارتباط با AI

`ProjectMember.skills` (فاز ۷): رشته‌های آزاد مثل `backend, marketing`. سرویس AI هنگام پیشنهاد assignee همین فیلد را می‌بیند. قواعد ویرایشش در [project.service.ts](application/project.service.ts) (`updateMember`) را ببین: خودِ عضو یا ADMIN می‌تواند ویرایش کند؛ تغییر role همان قواعد `membership-rules` را دارد.

## repository و DTO

- [prisma-project.repository.ts](infrastructure/prisma-project.repository.ts): مثال خوب از **aggregate query** — `groupBy` برای بار کاری اعضا (openTasks/openPoints) و stats پروژه. ببین چطور `openTaskWhere` یک predicate مشترک است (live = `deletedAt: null`).
- [project.dto.ts](http/project.dto.ts): تاریخ‌ها را `toISOString` می‌کند؛ کلاینت هیچ Date خامی نمی‌گیرد.

## سینتکس‌های قابل یادگیری

- `@@id([projectId, userId])` در schema — composite key و آدرس‌دهی با `projectId_userId` در update.
- `hasRole` به‌صورت تابع خالص + `RANK` به‌صورت `Record<ProjectRole, number>` — exhaustiveness به‌صورت تایپی.
- mount جالب در app.ts: `/me` برای `teamRouter` — منابع «من» را در یک prefix جمع کن.

## تمرین‌ها

1. جدول تصمیم `membership-rules` را به‌صورت تست پارامتری بنویس (cases از کامنت‌های خود تابع).
2. چرا `removeMember` بعد از حذف، هوک `onMemberRemoved` را صدا می‌زند و چه کسی آن را سیم‌کشی کرده؟ (به app.ts برگرد.)
