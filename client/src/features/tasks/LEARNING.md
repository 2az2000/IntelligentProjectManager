# درس‌نامه‌ی `features/tasks` — Kanban، درگ‌ودراپ و AI ⭐

مفصل‌ترین فیچر اپ؛ سه درس بزرگ دارد.

## درس ۱: درگ‌ودراپ با dnd-kit

`kanban-board.tsx` + `kanban-column.tsx` + `task-card.tsx`:

- `DndContext` + `SortableContext` — سنسور Pointer، `closestCorners` برای تشخیص هدف.
- **طرح‌ریزی درِاپ قبل از اجرا**: `lib/ordering.ts` (`computeDropPlan`) با همان ریاضی fractional از سمت سرور، `position` آینده و `beforeId/afterId` را محاسبه می‌کند — یعنی کلاینت همان چیزی را می‌بیند که سرور خواهد نوشت.
- دسترس‌پذیری: `dnd` keys در messages («برداشته شد»، «روی X است») برای screen reader — dnd-kit با announcements کار می‌کند.

## درس ۲: optimistic update ⭐ (مهم‌ترین هوک ریپو)

`hooks/use-tasks.ts` → `useMoveTask`:

```ts
onMutate:    cancelQueries → previous را نگه دار → cache را دستی آپدیت کن
onError:     rollback با previous
onSettled:   invalidateTaskViews (همیشه — موفق یا ناموفق)
```

این پنج‌خطی «حس برنامه‌ی دسکتاپی» می‌سازد: کارت فوری جابه‌جا می‌شود؛ اگر سرور رد کرد، برمی‌گردد و toast `moveFailed` می‌بینی. برای هر mutationای که UX حساس دارد، همین چهار مرحله را بنویس.

## درس ۳: جریان «تکمیل تسک با AI» (فاز ۷)

`create-task-dialog.tsx` را بخوان — نمونه‌ی کامل **preview-then-apply** از دید UI:

1. کاربر عنوان درشت می‌نویسد → دکمه‌ی «تکمیل با هوش مصنوعی» (`useEnrichTask`) → `POST /projects/:id/ai/enrich-task` (پیش‌نمایش؛ سرور چیزی نمی‌نویسد).
2. **AI فقط فیلدهای خالی را پر می‌کند** — شرط‌ها را ببین: `if (!form.getValues('description') && preview.description)`. کاربر حرف آخر را می‌زند؛ AI جایگزین او نیست.
3. زیرتسک‌های پیشنهادی به‌صورت چک‌باکس می‌آیند (حذف تک‌تک هم هست) و در submit، بعد از ساخت والد با `mutateAsync`، انتخاب‌شده‌ها به‌صورت زیرتسک واقعی (`parentId`) با `taskApi.create` ثبت می‌شوند.
4. کنار select مسئول، دلیل پیشنهاد AI (✨ reason) نمایش داده می‌شود؛ خودِ پیشنهاد از `suggestedAssignees[0]` فقط وقتی استفاده می‌شود که کاربر چیزی انتخاب نکرده باشد.
5. خطاها با کد سرور (`AI_NOT_CONFIGURED`، `AI_TIMEOUT`، ...) از `Errors.*` فارسی می‌شوند — پیام‌ها راهنمای «چیکار کنم» هستند.

چرا submit اسنشیال شد؟ چون چند درخواست پشت‌سرهم دارد؛ ببین try/catch دور `mutateAsync` چه می‌کند و به تفاوت `mutate`/`mutateAsync` فکر کن.

## بقیه‌ی اجزا

- `task-sheet.tsx` — پنل جزئیات با فرم ویرایش، کامنت‌ها، activity و پیوست‌ها؛ مثال composition از چند فیچر.
- `task-table.tsx` / `my-tasks.tsx` — نمای لیست و گروه‌بندی با سررسید؛ `task-calendar.tsx` نمای تقویم با `placeholderData: previous` (بدون پرش UI هنگام تعویض ماه).
- `schemas/task.schema.ts` — اعتبارسنجی فرم جدا از تایپ‌های API.

## تمرین‌ها

1. در `useMoveTask` خط `cancelQueries` را حذف کن و با network slow دو درگ سریع بزن — باگ را ببین و دلیلش را بنویس.
2. جریان AI را بدون کلید سرور امتحان کن: پیام کدام خطا را می‌بینی و کجای messages تعریف شده؟
3. تمرین چالشی: «تکمیل با AI» را به `task-sheet.tsx` هم بیاور تا تسکِ *موجود* هم با پیشنهاد AI کامل شود (endpoint سرور از قبل آماده است).
