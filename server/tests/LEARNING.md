# درس‌نامه‌ی `tests/` — integration با دیتابیس واقعی

اینجا mock شاه نیست: تست‌ها با **Postgres واقعی** و **supertest** روی خود اپ اجرا می‌شوند. اعتماد حاصل خیلی بیشتر از تست‌های mocked است و سرعت هم با `isolate: false` قابل قبول مانده.

## زیرساخت تست

- [global-setup.ts](global-setup.ts) — قبل از همه‌ی تست‌ها: دیتابیس `<name>_test` می‌سازد و `prisma migrate deploy` اجرا می‌کند. یعنی CI فقط به یک Postgres نیاز دارد.
- [test-db-url.ts](test-db-url.ts) — URL تست را از DATABASE_URL مشتق می‌کند (`_test` suffix)؛ اگر `TEST_DATABASE_URL` ست بود همان استفاده می‌شود.
- [setup.ts](setup.ts) — پاک‌سازی بین تست‌ها (`resetDb`).
- [helpers/factories.ts](helpers/factories.ts) — ⭐ **test factory pattern**: `createUser/createProject/createTask/loginAs`. `loginAs` با `request.agent` کوکی‌های session را بین درخواست‌ها نگه می‌دارد — دقیقاً مثل مرورگر واقعی.

## الگوی یک تست خوب (از همین ریپو)

```ts
const app = createApp({ db: prisma });      // همان composition root، بدون سرور

it("hides other users' projects behind 404", async () => {
  const me = await createUser();            // Arrange با فاکتوری
  const other = await createUser();
  const project = await createProject(other.id);
  const agent = await loginAs(app, me.email);

  const res = await agent.get(`/projects/${project.id}`);   // Act
  expect(res.status).toBe(404);                              // Assert
  expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
});
```

توجه کن تست‌ها همیشه **کد خطای دامنه** را چک می‌کنند (`PROJECT_NOT_FOUND`)، نه فقط استاتوس — قراردادِ کلاینت این کدهاست.

## تست AI بدون AI

[ai.int.test.ts](integration/ai.int.test.ts) سه ترفند دارد که در هر پروژه‌ای به کار می‌آید:

1. بدون کلید → `503 AI_NOT_CONFIGURED` را تست می‌کند (مسیر default).
2. `vi.stubGlobal('fetch', ...)` پاسخ مدل را با envelope واقعی OpenAI جعل می‌کند؛ هم موفقیت و هم provider 500.
3. بعد از enrich، `prisma.task.count() === 0` — اثبات اینکه endpoint واقعاً preview است و می‌نویسد؟ نمی‌نویسد.

## چک‌لیست چه چیزی را تست کنیم

از همین مجموعه یاد بگیر: مسیر شاد ✅ · auth (401) · دسترسی (403/404) · validation (400) · mass-assignment (فیلد اضافه رد شود) · race مهم (refresh reuse) · degradation (بدون redis/AI کار کند).

## تمرین‌ها

1. تست refresh rotation: توکن مصرف‌شده → `REFRESH_TOKEN_REUSED` و همه‌ی توکن‌های خانواده revoke.
2. برای فراخوانی paralel دو تب روی refresh (grace window) تست رقابتی بنویس.
3. پوشش ماژول AI را با تست «JSON دارای fence و متن اضافه» کامل کن — `extractJson` باید نجات دهد.
