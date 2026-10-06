# درس‌نامه‌ی `src/` — بوت‌استرپ و composition root

## سفر یک request (مهم‌ترین درس این پوشه)

وقتی `GET /projects/1/tasks` می‌آید این مسیر طی می‌شود — هر خط به کد واقعی [main.ts](main.ts) و [app.ts](app.ts) وصل است:

```
main.ts: http.createServer(app)  ←  Socket.IO هم روی همین http instance سوار می‌شود
  │
  ├─ pinoHttp        → هر درخواست یک x-request-id می‌گیرد؛ همان id در error response برمی‌گردد
  ├─ helmet          → هدرهای امنیتی + CSP
  ├─ cors(cred)      → CORS با credentials (چون auth کوکی است)
  ├─ express.json    → محدود به 1mb
  ├─ cookieParser    → کوکی‌های access_token / refresh_token را parse می‌کند
  ├─ originGuard     → CSRF دفاع عمقی: Origin/Referer باید با CORS_ORIGIN بخواند (403 CSRF_ORIGIN_MISMATCH)
  ├─ rateLimit       → بودجه‌ی درخواست هر IP (RATE_LIMIT_PER_MINUTE، پیش‌فرض 300)
  ├─ /health         → SELECT 1 روی DB؛ 200 یا 503
  │
  ├─ createXModule(...)   → همه‌ی ماژول‌ها همین‌جا ساخته و به هم وصل می‌شوند
  ├─ hooks.onChanged = …  → واکنش‌های بین‌ماژولی بدون وابستگی مستقیم (پایین را ببین)
  │
  ├─ app.use('/projects/:projectId/tasks', tasks.projectTasksRouter)   ← mount
  └─ notFoundHandler → errorHandler   ← همیشه آخرِ زنجیره
```

**چرا ترتیب middlewareها مهم است؟** `originGuard` و `rateLimit` باید *قبل* از روترها باشند تا روی همه‌ی endpointها اعمال شوند؛ `errorHandler` باید *آخر* باشد چون Express خطاها را به سمت پایین زنجیره می‌فرستد.

## composition root یعنی چه؟

به [app.ts](app.ts) نگاه کن:

```ts
const users = createUsersModule({ db });
const auth = createAuthModule({ db, users: users.service });
const tasks = createTasksModule({ db, projects: projects.service });
```

- هیچ ماژولی خودش وابسته‌اش را `new` نمی‌کند؛ همه‌چیز از بالا تزریق می‌شود (**Dependency Injection دستی**).
- ماژول‌ها به *interface* وابسته‌اند نه پیاده‌سازی: `tasks` فقط می‌داند `ProjectAccess` چه شکلی است (نگاه به بالای `task.service.ts`). همین باعث می‌شود تست‌ها با `createApp({db: prisma})` و بدون سرور واقعی کار کنند.
- **هوک‌ها = معکوس وابستگی**: `tasks.service.hooks.onChanged` در `app.ts` ست می‌شود تا activity + realtime + notification را اجرا کند. tasks از notifications *هیچ‌چیز* نمی‌داند — این یعنی معماری event-driven بدون هیچ کتابخانه‌ی اضافه. دقت کن که این هوک `await` می‌شود (activity و اعلان قبل از پاسخ HTTP ثبت می‌شوند) ولی `jobs.scheduleDueReminder` با `void` fire-and-forget است؛ چرا؟ چون reminder به صف Redis می‌رود و نباید پاسخ HTTP را نگه دارد.

## graceful shutdown در main.ts

سرور با SIGINT/SIGTERM اول `server.close()` می‌کند (دریافت درخواست‌های جدید متوقف)، بعد workerهای BullMQ را می‌بندد و آخر از Prisma جدا می‌شود. ترتیب مهم است: اول ورودی‌ها، بعد صف‌ها، بعد DB.

## تمرین

- یک `console.log` موقت بالای `originGuard` بگذار و ببین هر درخواست چند بار از زنجیره رد می‌شود.
- `app.use('/projects/:projectId/ai', ai.aiRouter)` را پیدا کن: چرا این mount **قبل از** `/projects` آمده تا با `mergeParams`، `projectId` را بگیرد؟
