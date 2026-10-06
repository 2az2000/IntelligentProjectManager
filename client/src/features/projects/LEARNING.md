# درس‌نامه‌ی `features/projects` + `features/users` — داده با useQuery

## الگوی استاندارد واکشی داده

سه لایه‌ی هر فیچر را در این ماژول کامل ببین:

```
api/project.api.ts     → فقط axios + تایپ پاسخ (هیچ stateای)
hooks/use-projects.ts  → useQuery/useMutation + کلیدها + invalidate
components/*           → فقط نمایش و فراخوانی هوک
```

`useProject(id)`: دقت کن به `enabled: validId(id)` — کوئری تا id معتبر نشده اجرا نمی‌شود (id از route می‌آید و می‌تواند زودتر از همه‌چیز بیاید).

## درس ۱: mutationها و invalidation هدفمند

`useCreateProject` بعد از موفقیت چه چیزی را invalidate می‌کند؟ `qk.projects.all + qk.dashboard`. هر invalidate‌ای که اضافه می‌کنی یعنی «این داده هم از این به بعد کهنه است» — کم بگذاری UI کهنه می‌ماند، زیاد بگذاری رفچ اضافه. همین ترازبندی، مهارت اصلی TanStack Query است.

## درس ۲: دسترسی در UI

`types.ts` همین سمت، جدول رتبه‌ی `hasRole` را هم دارد (آینه‌ی سرور). در `project-members.tsx` ببین `canManage`/`isOwner` چطور فقط UI را مدیریت می‌کنند — **واقعاً** چه کسی جلوی یک درخواست غیرمجاز را می‌گیرد؟ سرور (403). UI فقط تمیز است، امن نیست؛ این تفکیک را از حفظ باش.

## درس ۳: skills اعضا (فاز ۷)

`SkillsEditor` درون `project-members.tsx`: input comma-separated → آرایه با trim/filter → `useUpdateMember` با `patch: {skills}`. چرا این داده اهمیت دارد؟ چون دکمه‌ی «تکمیل با AI» در تسک‌ها همین مهارت‌ها را برای پیشنهاد assignee می‌بیند (به [features/tasks/LEARNING.md](../tasks/LEARNING.md) برگرد).

`features/users`: جستجوی کاربر با debounce (نگاه کن به هوکش) برای invite picker؛ نمونه‌ی کوچک و تمیز یک query با پارامتر.

## تمرین‌ها

1. `InviteMember` را بگرد: چرا نتایج جستجو فیلتر «از قبل عضو» را سمت کلاینت دارد؟ اگر هزاران کاربر بود چه؟
2. به `project-grid.tsx` نگاه کن: state فیلترها کجاست (useState؟ URL؟) و چرا.
