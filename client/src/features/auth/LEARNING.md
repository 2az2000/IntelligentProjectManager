# درس‌نامه‌ی `features/auth` — فرم، گارد و جریان لاگین

## فایل‌ها

- `components/login-form.tsx` / `register-form.tsx` — فرم با **React Hook Form + zodResolver**
- `components/auth-guard.tsx` — نگهبان صفحات لاگین‌شده
- `hooks/use-auth.ts` — هوک‌های mutation (login/register/logout) + `useCurrentUser`
- `api/auth.api.ts` — لایه‌ی axios نازک
- `schemas/` — Zod form schemas (اعتبارسنجی سمت کلاینت، مستقل از سرور)

## درس ۱: فرم‌ها با RHF + Zod

الگوی ثابت همه‌ی فرم‌های ریپو (این را درست یاد بگیر، همه‌جا تکرار می‌شود):

```tsx
const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: {...} });
const onSubmit = form.handleSubmit((values) => login.mutate(values, {onSuccess, onError}));
<Form {...form}>                       // shadcn Form = RHF context + accessibility
  <FormField name="email" render={({field}) => ...} />
```

- `defaultValues` (نه `values`) — uncontrolled تا رندر عقلانی بماند.
- خطای سرور هم می‌تواند *فیلدی* شود: ببین register چطور `EMAIL_TAKEN` را با `form.setError` روی input می‌نشاند و بقیه‌ی خطاها toast می‌گیرند.
- `noValidate` روی `<form>`: اعتبارسنجی فقط با Zod، نه پیام‌های بومی مرورگر.

## درس ۲: گارد (auth-guard.tsx)

`useCurrentUser()` → `pending | authed | guest` سه‌حالته است. ایده‌ی مهم: **نمایش صفحه‌ی میانی (spinner) تا مشخص شدن وضعیت**؛ ریدایرکت بدون این state باعث فلش لاگین در هر رفرش می‌شود. در صورت 401 (از `onUnauthorized` در api-client) هم اینجا به `/login` می‌رویم.

## درس ۳: invalidate چه چیزی؟

`use-auth.ts` بعد از لاگین/خروج چه queryهایی را دست می‌زند؟ (`queryClient.clear()` در logout). به [lib/LEARNING.md](../../lib/LEARNING.md) برگرد و کلیدها را ببین.

## تمرین‌ها

1. فرم لاگین را طوری تغییر بده که بعد از موفقیت به همان مسیری برگردد که کاربر می‌خواست (`?next=`) — از `useSearchParams` استفاده کن و دقت کن داخل Suspense چه می‌شود.
2. یک محدودیت قدرت پسورد به schema اضافه کن و ببین پیام خطا از کجا می‌آید (`Validation.*` در messages).
