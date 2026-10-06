# درس‌نامه‌ی `src/test/` — تست کامپوننت با سرور فیک

## سه فایل زیرساخت

- `msw-server.ts` — سرور **MSW** با همه‌ی `handlers`؛ هر تستی که axios صدا بزند، جواب از همین‌جا می‌آید (نه از سرور واقعی).
- `setup.ts` — vitest setup: `server.listen({onUnhandledRequest:'error'})` ⭐ یعنی هر request بدون handler = خطای تست. این امنیت بزرگ است: endpoint جدید بدون handler خودش را لو می‌دهد. cleanup بعد از هر تست + polyfill `ResizeObserver` برای jsdom (Radix لازمش دارد).
- `handlers.ts` — شبکه‌ی فیک با **فیکسچرهای export شده** (`project`, `tasks`, `projectMember`, ...). فیکسچر تایپ‌دار است (`satisfies Task`) پس اگر API تایپ عوض شود، فیکسچر هم کامپایل-خطا می‌دهد.

## الگوی تست کامپوننت (از kanban-board.test.tsx و create-task-dialog.test.tsx)

```tsx
const messages = (await import('../../../../messages/fa.json')).default;   // همان i18n واقعی
function createWrapper() {                                                  // providers حداقلی
  return ({children}) => (
    <NextIntlClientProvider locale="fa" messages={messages}>
      <QueryClientProvider client={new QueryClient({...})}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}
render(<KanbanBoard .../>, {wrapper: createWrapper()});
expect(screen.getByRole('region', {name: 'انجام نشده'}))...                 // query با نقش+نام فارسی
```

دو درس: **(۱)** assertionها روی نقش‌های a11y و متنِ واقعیِ فارسی کاربر است، نه کلاس‌های CSS؛ **(۲)** wrapper providerها را فقط تا اندازه‌ای بیاور که کامپوننت کار کند.

## override کردن شبکه در یک تست

`create-task-dialog.test.tsx` با `server.use(http.post(...))` مسیر ساخت تسک را موقتاً عوض می‌کند و آرایه‌ی `created` را پر می‌کند — بعد assert می‌شود که اول والد و بعد سه زیرتسک با `parentId` درست ساخته شده‌اند. این، تستِ **ترتیب اثرها** است نه فقط رندر.

## چک‌لیست نوشتن تست جدید

1. فیکسچر کم دارم؟ → در `handlers.ts` export کن (تایپ‌دار).
2. endpoint جدید؟ → handler اضافه کن، وگرنه `onUnhandledRequest: 'error'` می‌گیردت.
3. user-event استفاده کن نه fireEvent (نزدیک‌تر به واقعیت).
4. برای asyncها `await waitFor(...)` / `findBy*` — هرگز sleep.

## تمرین‌ها

1. تست برای `SkillsEditor` بنویس: تایپ «backend, api»، کلیک ذخیره، assert روی body درخواست PATCH.
2. تست خطای AI: handler را طوری override کن که `503 AI_NOT_CONFIGURED` بدهد و assert کن پیام فارسی درست نمایش داده می‌شود.
