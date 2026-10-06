# درس‌نامه‌ی `features/settings` — چند فرم مستقل در یک صفحه + کارت AI

## الگوی «کارت‌های مستقل»

[settings-panel.tsx](components/settings-panel.tsx) فقط یک لیست از کارت‌هاست؛ هر کارت `ProfileCard` / `PreferencesCard` / `NotificationsCard` / `PasswordCard` **فرم و mutation خودش** را دارد. درس: صفحه‌های بزرگ را به جزایر مستقل بشکن — هر کارت state و save خودش را دارد و خطای یکی بقیه را نمی‌گیرد.

## درس‌های هر کارت

- `PreferencesCard` — تغییر زبان: اول `update.mutate` به سرور (persist)، بعد `router.replace(pathname, {locale})` برای تغییر مسیر. ترتیب مهم است: UI را با سرور هم‌راستا نگه دار. تم با `next-themes` + ذخیره در پروفایل.
- `PasswordCard` — خطای دامنه‌ای: کد `INVALID_CURRENT_PASSWORD` از سرور جدا می‌شود و با `form.setError` **روی فیلد** می‌نشیند نه toast. الگوی «خطای فیلدی از سمت سرور» را همین‌جا ببین.
- `NotificationsCard` — toggle بدون دکمه‌ی save؛ mutation فوری روی `onCheckedChange`. چه زمانی فرم با دکمه و چه زمانی فوری؟ (پاسخ: برگشت‌پذیری/هزینه‌ی اشتباه.)

## کارت داکیومنت AI (فاز ۷) ⭐

`AiProjectDocCard` پایین صفحه:

1. لیست پروژه‌ها (`useProjects`) → select؛ سپس `useProjectDoc` (mutation) → `POST /projects/:id/ai/project-doc`.
2. خروجی **Markdown رشته‌ای** است و اینجا به‌صورت پیش‌نمایش ساده (`<pre dir="auto">`) نشان داده و با clipboard کپی می‌شود — عمداً **ذخیره نمی‌شود**؛ همان اصل preview-then-apply: مالکیت متن با کاربر است، هرجا خواست (Wiki، ریپو، ایمیل) می‌بردش.
3. حین `generate.isPending` پیام «چند ثانیه طول می‌کشد» چون LLM کند است — UX صادقانه بهتر از spinner بی‌نهایت.
4. خطای `AI_NOT_CONFIGURED` پیام عملی دارد («کلید را در server/.env بگذار») — پیام خطا باید بگوید قدم بعدی چیست.

## تمرین‌ها

1. به کارت AI یک state «پروژه‌ی انتخاب‌شده در URL» (`?project=`) اضافه کن تا لینک‌پذیر شود.
2. چرا کارت‌ها با `key={user.id}` در ProfileCard remount می‌شوند؟ (درباره‌ی reset فرم وقتی داده‌ی اولیه عوض می‌شود فکر کن.)
