# درس‌نامه‌ی `modules/ai` — LLM بدون vendor lock-in

جدیدترین ماژول (فاز ۷) و بهترین نمونه‌ی «سرویس خارجی را چطور تمیز بپیچیم».

## معماری در سه جمله

1. سرویس با **هر endpoint سازگار OpenAI** کار می‌کند (`POST {AI_BASE_URL}/chat/completions`) — پیش‌فرض Groq (رایگان)، گزینه‌ها در `.env.example`: Google AI Studio (Gemini)، OpenRouter. هیچ SDK نصب نیست؛ فقط `fetch`.
2. هر دو endpoint **پیش‌نمایش** می‌دهند و هیچ چیزی در DB نمی‌نویسند — کاربر می‌بیند، انتخاب می‌کند، و اعمال از مسیرهای عادی (create task / subtask) انجام می‌شود. این الگو `preview-then-apply` است: هیچ‌وقت خروجی LLM را مستقیم و بدون مرور انسان commit نکن.
3. کلید نبود؟ `503 AI_NOT_CONFIGURED` — بقیه‌ی اپ سالم می‌ماند. سرویس اختیاری، شکستش هم اختیاری.

## فایل‌به‌فایل

- [ai.service.ts](ai.service.ts) — مغز ماژول. بخش‌ها را به ترتیب بخوان:
  - **قراردادها**: `ProjectAccess` همان interface آشنای ماژول‌های دیگر (DI).
  - **validation خروجی مدل** ⭐: `rawEnrichSchema` — پاسخ LLM *ورودیِ غیرقابل‌اعتماد* است و مثل body کاربر با Zod چک می‌شود. پیشنهاد assignee برای غیرعضو (userId ساختگی مدل!) بی‌سروصدا حذف می‌شود.
  - `chat()` — درخواست با timeout (`AbortController` + `AI_TIMEOUT_MS`)، `response_format: json_object` برای enrich، و پاسخ‌های خطا به `AI_PROVIDER_ERROR/AI_TIMEOUT` map می‌شوند (502/504، نه 500 خام).
  - `buildContext*` — **فقط** داده‌هایی که لازم است به مدل می‌رود: نام اعضا + role + skills + بار کاری، ۳۰ تسک آخر. نه متن کامنت‌ها، نه ایمیل‌ها. اصل کمینه‌سازی داده به سمت ثالث.
  - **پرامپت‌ها** به‌صورت ثابت‌های انگلیسی با قاعده‌ی صریح: «userId را از لیست کپی کن؛ چیزی از خودت نساز» + زبان خروجی از `locale` کاربر. پرامپت = کد؛ مثل کد با آن رفتار کن.
- [ai.routes.ts](ai.routes.ts) — limiter تنگ (۱۰/دقیقه) چون هر درخواست هزینه‌ی واقعی/نرخ-محدودیت رایگان دارد. دو endpoint: `POST /projects/:id/ai/enrich-task` و `POST /projects/:id/ai/project-doc`.
- [ai.schemas.ts](ai.schemas.ts) / [ai.types.ts](ai.types.ts) — ورودی/خروجی تایپ‌دار، export برای OpenAPI.

## چیزی که UI با پیش‌نمایش می‌کند

در کلاینت (`create-task-dialog.tsx`) ببین: فقط فیلدهای **خالی** پر می‌شوند (AI جایگزین کاربر نمی‌شود)، زیرتسک‌ها چک‌باکس می‌گیرند و با ساخت والد، به‌صورت زیرتسک واقعی (همان Task با parentId) ثبت می‌شوند؛ دلیل پیشنهادِ هر assignee کنار select نمایش داده می‌شود.

## درس‌های قابل استفاده در هر پروژه‌ی دیگر

1. `fetchImpl` تزریقی است → تست با `vi.stubGlobal('fetch', ...)` بدون کلید و شبکه (ببین `tests/integration/ai.int.test.ts`).
2. `extractJson` حاشیه‌های ```json را می‌تراشد و اولین `{...}` را می‌گیرد — مدل‌ها همیشه تمیز جواب نمی‌دهند؛ خطا هم 502 با کد مشخص است نه crash.
3. هزینه/نرخ: limiter + timeout + عدم ذخیره = سه کنترل اصلی هزینه‌ی LLM در API.

## تمرین‌ها

1. provider را عوض کن: در `.env` فقط `AI_BASE_URL` و `AI_MODEL` را به Google AI Studio تغییر بده و enrich را بزن — همان کد، بدون یک خط تغییر.
2. قابلیت «برآورد ساعت برای تسک‌های بدون تخمین» را با همان الگو اضافه کن: endpoint جدید preview + prompt + تست.
3. چرا `enrichTask` نقش MEMBER می‌خواهد ولی `project-doc` VIEWER؟ (درباره‌ی حداقل‌مجوز برای خواندن vs پیشنهاد فکر کن.)
