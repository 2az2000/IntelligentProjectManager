# ۰۱ — نقشه‌ی راه فازبندی‌شده (Roadmap)

> مبنا: [00-AUDIT.md](00-AUDIT.md) · ساختار هدف: [server](../server/docs/ARCHITECTURE.md) / [client](../client/docs/ARCHITECTURE.md) · API: [02-API-CONTRACT.md](02-API-CONTRACT.md)
>
> **قاعده:** فازها ترتیبی هستند. هر فاز فقط وقتی تمام است که همه‌ی موارد **Definition of Done** آن تیک خورده باشد.
> تخمین‌ها برای یک توسعه‌دهنده‌ی full-stack است.

## 📍 وضعیت فعلی

> **فاز جاری: ۴ — Smart scheduling** · آخرین به‌روزرسانی: 2026-09-30
> این بخش بعد از اتمام هر فاز به‌روز می‌شود. جزئیات هر تغییر در [گزارش پیشرفت](#-گزارش-پیشرفت-changelog) انتهای همین سند.

| فاز | عنوان | هدف یک‌خطی | تخمین | وضعیت |
|---|---|---|---|---|
| ۰ | Foundation | پروژه با یک دستور بالا بیاید؛ ابزار کیفیت و ستون‌های backend آماده | ۳–۴ روز | ✅ تمام |
| ۱ | Restructure | کد فعلی به ساختار هدف منتقل شود، بدون تغییر رفتار | ۴–۵ روز | ✅ تمام |
| ۲ | Auth & Users | ورود/ثبت‌نام، عضویت در پروژه، حذف همه‌ی کاربرهای هاردکد | ۵–۶ روز | ✅ تمام |
| ۳ | Complete current features | هر دکمه، لینک و صفحه‌ی موجود واقعاً کار کند | ۱۰–۱۴ روز | ✅ تمام |
| ۴ | Smart scheduling | Dependencyها، CPM، Timeline/Gantt، فایل پیوست | ۷–۱۰ روز | 🟡 در حال انجام |
| ۵ | Real-time & Notifications | board زنده، اعلان، activity log، jobهای پس‌زمینه | ۶–۸ روز | ⏳ |
| ۶ | Production-ready | تست، CI/CD، Docker، امنیت، مستندات API | ۵–۷ روز | ⏳ |
| ۷ | Advanced features | تقویم شمسی، Command Palette، Workload heatmap، پیش‌بینی Monte Carlo، دستیار AI | ۱۰–۱۵ روز | ⏳ |

راهنمای وضعیت: ✅ تمام · 🟡 در حال انجام · ⏳ شروع نشده · ⚠️ ناقص (توضیح در changelog)

---

## فاز ۰ — Foundation

**هدف:** بدون کار دستی بالا بیاید؛ ستون‌های backend (config، error، validate، logger) و ابزارهای کیفیت آماده باشند.

### Repo و زیرساخت
- [x] `git init` در root؛ تاریخچه‌ی `client/.git` حذف یا با `git subtree` ادغام شود (monorepo واحد).
- [x] `.gitignore` در root (`node_modules`, `.env*` به‌جز `.env.example`, `.next`, `dist`).
- [x] `docker-compose.yml` در root: `postgres:16` روی `5433:5432` با volume؛ (سرویس `redis` کامنت‌شده برای فاز ۵).
- [x] `server/.env.example` و `client/.env.example` (`NEXT_PUBLIC_API_URL`).
- [x] README ریشه با راه‌اندازی (پیش‌نویس ساخته شده — به‌روز شود).

### Server
- [x] جایگزینی `ts-node`/`nodemon` با `tsx`؛ `tsconfig` → target `ES2022`؛ اسکریپت‌های `build/start/typecheck/lint/test` ([CONVENTIONS §۱۴](../server/docs/CONVENTIONS.md)).
- [x] `src/config/env.ts` با Zod (fail-fast؛ secret پیش‌فرض ندارد).
- [x] `src/shared/errors/*` (`AppError` + زیرکلاس‌ها) و `shared/http/error-handler.ts` + `not-found.ts` (نگاشت خطاهای Prisma).
- [x] `shared/http/handle.ts` — wrapper تایپ‌شده که params/query/body را با Zod 4 اعتبارسنجی می‌کند (جایگزین `validationMiddleware.ts`).
- [x] logger با pino + `pino-http` و requestId؛ حذف morgan.
- [x] `src/main.ts`: هندل خطای `listen` (EADDRINUSE با پیام واضح) و graceful shutdown (`SIGTERM` → `prisma.$disconnect`).
- [x] CORS محدود به `CORS_ORIGIN` با `credentials: true`.
- [x] `GET /health`.
- [x] ESLint (typescript-eslint، `no-explicit-any`، `no-console`) + Prettier.
- [x] Vitest؛ انتقال `test_algo.ts` به `critical-path.test.ts` و افزودن تست cycle برای `DependencyResolver`.

### Database
- [x] baseline migration `20260928000000_init` (با `migrate diff` + `migrate resolve` ساخته شد تا داده‌ها حفظ شوند).
- [x] `prisma/seed.ts`: کاربر admin + یک پروژه‌ی نمونه با چند تسک (جایگزین INSERT دستی).

### Client
- [x] `src/middleware.ts` → `src/proxy.ts`.
- [x] `src/i18n/navigation.ts` جدا (`createNavigation`)؛ `routing.ts` فقط `defineRouting`.
- [x] `[locale]/layout.tsx`: `params: Promise<...>`، `hasLocale` + `notFound()`، `generateStaticParams`، `setRequestLocale`.
- [x] load فونت با `next/font` (Geist برای en، Vazirmatn برای fa).
- [x] `public/sw.js` حذف (تا فاز ۶).
- [x] Prettier + `prettier-plugin-tailwindcss`؛ اسکریپت `typecheck`.

**✅ Definition of Done**
- [x] `docker compose up -d && (cd server && npm i && npm run db:migrate && npm run db:seed && npm run dev)` و `cd client && npm run dev` روی یک سیستم تمیز کار می‌کند.
- [x] `npm test` سبز؛ زیرساخت lint/typecheck آماده. ⚠️ خطاهای lint/type باقی‌مانده همه در کد قدیمی‌اند که در فاز ۱ بازنویسی می‌شود — شرط سبز شدن کامل به DoD فاز ۱ منتقل شد.
- [x] خطای هر endpoint با فرمت `{ error: { code, message } }` برمی‌گردد.

---

## فاز ۱ — بازسازی ساختار (Restructure)

**هدف:** همان رفتار فعلی، روی ساختار هدف. بعد از این فاز هر فیچر جدید جای مشخصی دارد.

### Server
- [x] `src/modules/projects/` (domain/application/infrastructure/http) از فایل‌های فعلی `Project.ts`، `CreateProjectUseCase`، `GetProjectsUseCase`، `PrismaProjectRepository`، `ProjectController`، `projectRoutes`.
- [x] `src/modules/tasks/` — حذف همه‌ی `any` در `ITaskRepository`/`TaskUseCase`؛ استفاده از entity `Task`؛ `task.mapper.ts`.
- [x] `src/modules/scheduling/domain/` ← انتقال `DependencyResolver.ts` و `CriticalPathEngine.ts`.
- [x] composition root در `app.ts`: `createApp({ db })` → `createProjectsModule({ db })`، `createTasksModule({ db, projects })`.

- [x] Zod schema برای همه‌ی endpointهای موجود؛ body با `.strict()` (رفع mass assignment).
- [x] endpointهای جدید `GET/POST /projects/:projectId/tasks`؛ حذف `POST /tasks` و `GET /tasks/project/:id`.
- [x] حذف پوشه‌های خالی قدیمی (`interfaces/`, `infrastructure/web/`...)؛ ESLint `no-restricted-imports` برای مرز ماژول‌ها.
- [x] تست integration برای هر endpoint موجود.

### Client
- [x] ساختار `features/{projects,tasks}/{api,hooks,components,schemas,types.ts,index.ts}`؛ انتقال `Task` type از `taskApi.ts` به `types.ts`.
- [x] `lib/query-keys.ts`، `lib/query-client.ts` (staleTime، retry)، `lib/api-client.ts` با `normalizeError`.
- [x] hookها: `useProjects`, `useCreateProject`, `useProjectTasks`, `useCreateTask`, `useUpdateTaskStatus` (optimistic + rollback).
- [x] `components/layout/` (تقسیم `AppShell.tsx` به sidebar/navbar)؛ `usePathname` از `@/i18n/navigation`.
- [x] `components/shared/`: `PageHeader`, `EmptyState`, `ErrorState`, `loading-skeletons`؛ `sonner` برای toast. (`ConfirmDialog` به فاز ۳ منتقل شد — اولین جایی که حذف لازم است.)
- [x] فرم‌های «پروژه‌ی جدید» و «تسک جدید» با react-hook-form + Zod؛ جدا شدن `CreateProjectDialog` و `CreateTaskDialog` از صفحات.
- [x] `KanbanBoard`: حذف state کپی‌شده (`useState` + `useEffect`)؛ خواندن از cache.
- [x] جایگزینی رنگ‌های خام با tokenها؛ کلاس‌های فیزیکی با logical (RTL).

**✅ Definition of Done**
- [x] همه‌ی رفتارهای فعلی (لیست/ساخت پروژه، board، ساخت تسک، drag بین ستون‌ها، تغییر زبان، dark mode) مثل قبل کار می‌کنند.
- [x] هیچ `any` در server؛ هیچ `useQuery` مستقیم در `app/`.
- [x] تست‌ها سبز.

---

## فاز ۲ — احراز هویت و کاربران (JWT داخلی)

### Database (migration: `auth_and_membership`)
- [x] `User`: افزودن `email @unique` (اجباری)، `passwordHash`، `name`، `avatarUrl`، `locale`، `theme`؛ حذف `cognitoId`، `username`، `profilePictureUrl`، `role` سراسری، `teamId`.
- [x] `RefreshToken`، `ProjectMember` (+ enum `ProjectRole`)؛ `Project.ownerId` اجباری.
- [x] حذف `Team`، `ProjectTeam`، `TaskAssignment`.
- [x] migration داده: برای هر پروژه‌ی موجود، owner → `ProjectMember(OWNER)`.

### Server
- [x] `modules/auth`: register، login، refresh (rotation + reuse detection)، logout، me — [API-CONTRACT §Auth](02-API-CONTRACT.md#auth).
- [x] `shared/auth/require-auth.ts` (خواندن از cookie؛ `TOKEN_EXPIRED` جدا از `UNAUTHENTICATED`)؛ `types/express.d.ts` برای `req.user`.
- [x] چک نقش در service (`ProjectService.assertRole`) + interface `ProjectAccess` برای ماژول tasks؛ روی همه‌ی endpointهای پروژه/تسک اعمال شد. (به‌جای middleware، چون نقش برای تسک‌ها از `task.projectId` به دست می‌آید.)
- [x] `authorId`/`ownerId` فقط از `req.user.id`؛ `GET /projects` فقط پروژه‌های عضو.
- [x] `cookie-parser`، `express-rate-limit` روی `/auth/*`.
- [x] حذف `authMiddleware.ts` قدیمی (در فاز ۱ همراه پوشه‌ی `interfaces/`).

- [x] تست: register/login/refresh/logout، دسترسی بدون لاگین (401)، پروژه‌ی دیگران (404).

### Client
- [x] `features/auth`: `authApi`، `useCurrentUser`، `useLogin`، `useRegister`، `useLogout`.
- [x] صفحات `(auth)/login` و `(auth)/register` (فرم با Zod، پیام خطای ترجمه‌شده).
- [x] `(app)/layout.tsx` با guard: loading → اگر 401 redirect به `/login?next=`.
- [x] `api-client`: `withCredentials`، interceptor refresh single-flight؛ حذف `localStorage`.
- [x] `UserMenu` در Navbar (نام، آواتار، Settings، Logout) — جایگزین دکمه‌ی بی‌عملکرد User.
- [x] حذف `authorId: 1` از board.

**✅ Definition of Done**
- [x] بدون لاگین هیچ داده‌ای قابل دریافت نیست (UI و API).
- [x] دو کاربر مختلف فقط پروژه‌های خودشان را می‌بینند.
- [x] توکن در هیچ storage جاوااسکریپتی نیست؛ refresh خودکار بعد از ۱۵ دقیقه بدون logout کار می‌کند.

---

## فاز ۳ — تکمیل فیچرهای فعلی

**هدف:** هیچ لینک مرده، دکمه‌ی دکوری یا داده‌ی mock باقی نماند.

### Database (migration: `task_enums_position_comments`)
- [x] enumهای `TaskStatus` (شامل `REVIEW`) و `TaskPriority` + تبدیل داده‌های رشته‌ای فعلی.
- [x] `Task`: `position Float`، `completedAt`، `deletedAt`، `tags String[]`، indexها.
- [x] `Project`: `archivedAt`، `deletedAt`.
- [x] `Comment`: `createdAt`، `updatedAt`، `deletedAt`؛ `onDelete: Cascade`.
- [x] `onDelete` صریح روی همه‌ی relationها.

### Projects
- [x] Server: `GET/PATCH/DELETE /projects/:id`، members CRUD، `stats` در `ProjectDto`.
- [x] Client: صفحه‌ی `projects/[projectId]/settings` (ویرایش نام/توضیح/تاریخ، مدیریت اعضا با جستجوی کاربر، حذف با `ConfirmDialog`)؛ دکمه‌ی «Settings» روی کارت پروژه به آن وصل شود.
- [x] `projects/[projectId]/layout.tsx` با هدر پروژه و tabهای Board / List / Settings.
- [x] کارت پروژه: progress bar (done/total)، تعداد overdue، آواتار اعضا.

### Tasks
- [x] Server: `GET/PATCH/DELETE /tasks/:id`، `POST /tasks/:id/move` (fractional position)، subtasks (`parentId`)، فیلترها.
- [x] Client — **Task Detail Drawer** (Sheet، باز شدن با کلیک روی کارت و URL `?task=ID`): ویرایش inline همه‌ی فیلدها، assignee از اعضا، dueDate با date picker (شمسی در fa)، subtasks با checkbox، حذف.
- [x] Kanban: reorder داخل ستون و بین ستون‌ها، optimistic + rollback، فیلتر assignee/priority/search، دکمه‌ی «+» در هر ستون، `KeyboardSensor` با announcements ترجمه‌شده.
- [x] view «List» (جدول با sort/filter، `projects/[projectId]/list`).

### Comments
- [x] Server: `modules/comments` کامل.
- [x] Client: بخش کامنت در drawer (ارسال، ویرایش، حذف، زمان نسبی).

### صفحات دیگر
- [x] **My Tasks** (`/my-tasks`، جایگزین `/tasks?projectId=`): تسک‌های assign‌شده به من، گروه‌بندی Overdue / امروز / این هفته / بعداً.
- [x] **Calendar** (`/calendar`): نمای ماهانه‌ی تسک‌ها بر اساس dueDate (`GET /me/calendar`)؛ تقویم شمسی در fa.
- [x] **Members** (`/members`): جایگزینی `MOCK_MEMBERS` با اعضای پروژه‌های من + workload واقعی (مجموع points باز).
- [x] **Dashboard** (`/`): `GET /dashboard/summary` — کارت‌های آمار، نمودار وضعیت، تسک‌های سررسید نزدیک، پروژه‌های اخیر. لیست کامل پروژه‌ها فقط در `/projects`.
- [x] **Settings**: پروفایل (نام، آواتار)، تغییر رمز، زبان و تم ذخیره در `PATCH /users/me`؛ بخش Notifications تا فاز ۵ پنهان شود.
- [x] Bell در Navbar تا فاز ۵ پنهان شود.

### i18n / RTL / UX
- [x] همه‌ی متن‌ها در `messages/{en,fa}.json` (namespace به ازای feature)؛ پیام خطاها بر اساس `error.code`.
- [x] بازبینی کامل RTL در همه‌ی صفحات (Sheet سمت راست در fa، آیکون‌های جهت‌دار).
- [x] Skeleton / EmptyState / ErrorState در همه‌ی صفحات داده‌دار.
- [x] `not-found.tsx` و `error.tsx` ترجمه‌شده.

**✅ Definition of Done**
- [x] هر آیتم sidebar و هر دکمه کار واقعی انجام می‌دهد؛ `grep -r MOCK_ client/src` خالی است.
- [x] هیچ متن انگلیسی هاردکد در fa دیده نمی‌شود.
- [x] ترتیب کارت‌ها بعد از refresh حفظ می‌شود.
- [x] تست E2E: login → ساخت پروژه → دعوت عضو → ساخت تسک → drag → کامنت.

---

## فاز ۴ — Scheduling هوشمند

### Database (migration: `dependencies_estimates_attachments`)
- [ ] `TaskDependency (predecessorId, successorId, type)` با `onDelete: Cascade`.
- [ ] `Task.estimateHours`؛ `Attachment` کامل (mimeType، size، storageKey، createdAt، relation uploader).

### Server
- [ ] `modules/scheduling`: `ScheduleService` — خواندن تسک‌ها + dependencyها ⇒ `CriticalPathEngine` ⇒ `ScheduleDto`.
- [ ] endpointهای dependency با جلوگیری از cycle (`DependencyResolver.detectCycle` قبل از insert ⇒ 409 `DEPENDENCY_CYCLE`) و منع dependency بین پروژه‌ها.
- [ ] تبدیل duration به تاریخ واقعی (روزهای کاری؛ تعطیلی پنجشنبه/جمعه قابل تنظیم برای ایران).
- [ ] `modules/attachments`: آپلود با `multer` به MinIO/S3 (سرویس `minio` در docker-compose) یا دیسک محلی در dev؛ لینک امضاشده.

### Client
- [ ] Task drawer: بخش «وابسته به» / «مسدود می‌کند» با جستجوی تسک.
- [ ] `projects/[projectId]/timeline`: Gantt (کتابخانه با `next/dynamic`) با هایلایت مسیر بحرانی، slack، خطوط dependency.
- [ ] نمایش «تاریخ پایان پیش‌بینی‌شده» پروژه در هدر.
- [ ] آپلود/دانلود/حذف attachment در drawer (drag & drop فایل).

**✅ Definition of Done**
- [ ] ساخت cycle از UI ممکن نیست و پیام واضح می‌دهد.
- [ ] Timeline برای پروژه‌ی seed مسیر بحرانی درست را نشان می‌دهد (تست واحد + E2E).

---

## فاز ۵ — Real-time، Notifications، Background jobs

- [ ] docker-compose: سرویس `redis`؛ `REDIS_URL` در env.
- [ ] **Socket.IO**: احراز هویت handshake با cookie؛ room به ازای پروژه؛ انتشار رویدادهای task/comment پس از commit.
- [ ] Client: `useProjectSocket(projectId)` ⇒ `setQueryData`/`invalidateQueries`؛ نشانگر «چه کسی آنلاین است».
- [ ] **ActivityLog**: ثبت خودکار تغییرات تسک (status، assignee، dueDate…) در service؛ تایم‌لاین در drawer.
- [ ] **Notifications**: جدول + API؛ رویدادها: assign به من، mention، کامنت روی تسک من، نزدیک شدن dueDate.
- [ ] **BullMQ**: job یادآوری dueDate (۲۴ ساعت قبل)، digest ایمیل روزانه (nodemailer + قالب fa/en).
- [ ] Client: Bell با badge تعداد خوانده‌نشده، dropdown لیست، «همه خوانده شد»؛ تنظیمات notification در Settings.
- [ ] `@mention` در کامنت‌ها.

**✅ Definition of Done**
- [ ] دو مرورگر با دو کاربر: drag در یکی بدون refresh در دیگری دیده می‌شود.
- [ ] assign کردن تسک ⇒ اعلان فوری برای کاربر مقصد.

---

## فاز ۶ — Production-ready

- [ ] تست: پوشش domain/scheduling ≥ ۸۰٪؛ integration برای همه‌ی endpointها؛ Playwright برای flowهای اصلی در هر دو زبان.
- [ ] **CI (GitHub Actions)**: install → lint → typecheck → test (با Postgres service) → build، برای client و server.
- [ ] **Docker**: Dockerfile چندمرحله‌ای برای server (`node dist/main.js`، کاربر non-root) و client (`output: 'standalone'`)؛ `docker-compose.prod.yml` + reverse proxy (Caddy/Nginx) با HTTPS؛ API پشت همان دامنه (`/api`).
- [ ] **امنیت**: helmet با CSP، CSRF (double-submit token یا `SameSite=Strict` + چک Origin)، rate-limit سراسری، audit وابستگی‌ها (`npm audit` در CI)، محدودیت حجم body.
- [ ] **OpenAPI**: تولید از Zod (`@asteasolutions/zod-to-openapi`) + Swagger UI در `/docs` (فقط غیر production یا با auth).
- [ ] **Observability**: Sentry در client و server؛ لاگ JSON؛ healthcheck در Docker.
- [ ] **PWA**: service worker فقط برای assetهای استاتیک و صفحه‌ی offline.
- [ ] backup خودکار دیتابیس.

**✅ Definition of Done**
- [ ] یک `docker compose -f docker-compose.prod.yml up` نسخه‌ی production را با HTTPS بالا می‌آورد.
- [ ] هر PR بدون CI سبز قابل merge نیست.

---

## بعد از فاز ۶
پیشنهادهای توسعه‌ی بعدی در [03-IMPROVEMENTS.md](03-IMPROVEMENTS.md).

---

## 📝 گزارش پیشرفت (Changelog)

### 2026-09-30 — فاز ۳ تمام شد ✅
**Database** — migration `20260929000000_task_enums_position_comments`
- enumهای `TaskStatus` (+ `REVIEW`) و `TaskPriority`؛ `Task` با `position` (fractional indexing در `modules/tasks/domain/position.ts`)، `completedAt`، `deletedAt`، `tags String[]` و index ترکیبی؛ `Project.archivedAt/deletedAt`؛ `Comment.createdAt/updatedAt/deletedAt`؛ `onDelete` صریح روی همه‌ی relationها.

**Server**
- ماژول `comments` کامل؛ CRUD پروژه (`GET/PATCH/DELETE /projects/:id`)، members CRUD با جستجوی کاربر و چک نقش، `stats` در `ProjectDto`؛ `GET/PATCH/DELETE /tasks/:id`، `POST /tasks/:id/move`، subtasks، `GET /me/tasks` و `GET /calendar`؛ `GET /dashboard/summary` (ماژول dashboard).
- **رفع باگ:** در `createProjectBody` فیلدهای `description/startDate/endDate` فقط `.optional()` بودند و کلاینت `null` می‌فرستاد ⇒ خطای 400 و شکستن «پروژه‌ی جدید» از UI. با `.nullish()` رفع شد (تست E2E همین را کشف کرد).

**Client**
- همه‌ی صفحات تکمیل شدند: Project Settings (ویرایش + اعضا + حذف با ConfirmDialog)، tabهای Board/List/Settings، **TaskSheet** (ویرایش inline، assignee، date picker شمسی، subtasks، کامنت‌ها)، My Tasks، Calendar، Members، Dashboard — `grep -r MOCK_` خالی است.
- Kanban: reorder داخل/بین ستون با fractional position و optimistic + rollback، فیلترهای search/priority/assignee، `KeyboardSensor`.
- کارت پروژه با progress bar، overdue و آواتار اعضا؛ تنظیمات پروفایل + تغییر رمز با `PATCH /users/me`.
- i18n کامل (۲۷۲ کلید در fa/en)؛ `not-found` و `error` ترجمه‌شده؛ بازبینی RTL.
- **تست:** ۲۸ تست واحد/کامپوننت (Vitest + Testing Library + MSW) + **E2E با Playwright** (`e2e/phase3.spec.ts`، ۳ تست سبز): login → ساخت پروژه → دعوت عضو → ساخت تسک → drag بین ستون‌ها → کامنت، به‌همراه ماندگاری ترتیب بعد از refresh، login ناموفق و redirect مسیر محافظت‌شده.

**تأیید**
- server: typecheck + ۴۷ تست سبز؛ client: lint/typecheck + ۲۸ تست + E2E سبز؛ `grep MOCK_` = صفر.
- همه‌ی دکمه‌ها و صفحه‌های فعلی عملکرد واقعی دارند؛ هیچ متن هاردکد انگلیسی در fa باقی نمانده.

**باقی‌مانده‌ی آگاهانه** (طبق برنامه در فازهای بعد): آرشیو/سطل زباله‌ی پروژه (`archivedAt/deletedAt` در schema آماده است ولی UI هنوز ندارد).
### 2026-09-28 — فاز ۰ تمام شد ✅
**زیرساخت**
- git repo در root ساخته شد (monorepo). تاریخچه‌ی قبلی `client/.git` (فقط commit اولیه‌ی create-next-app) در `.backup/client-git` نگه داشته شد.
- `docker-compose.yml`: سرویس `postgres` (container `pm-postgres`، پورت 5433، volume `pgdata`، healthcheck). اطلاعات اتصال در `.env` ریشه (نمونه: `.env.example`).
- کانتینر قبلی با compose جایگزین شد؛ داده‌ها با `pg_dump` پشتیبان‌گیری و بازگردانی شدند (`.backup/pm-data-20260928.sql`).

**Server**
- `tsx watch` به‌جای ts-node/nodemon؛ TypeScript 6 با `module: nodenext`، target ES2022، `noUncheckedIndexedAccess`.
- پوشه‌های جدید: `src/config/env.ts`، `src/shared/{errors,http,db,logger.ts}`، `src/app.ts` (`createApp()`)، `src/main.ts`.
- فرمت خطای یکسان `{ error: { code, message, details, requestId } }`؛ نگاشت خطاهای Zod، Prisma (P2002/P2003/P2025) و JSON نامعتبر.
- pino + pino-http با `x-request-id`؛ morgan حذف شد.
- `GET /health` (با چک دیتابیس). CORS فقط `CORS_ORIGIN`.
- ESLint (flat config، `no-explicit-any`، `no-console`، مرز ماژول‌ها) + Prettier + Vitest (۵ تست برای CPM و DependencyResolver).
- Prisma: اولین migration + `prisma/seed.ts` (کاربر admin، پروژه‌ی «Website Redesign» با ۴ تسک).

**Client**
- `middleware.ts` → `proxy.ts`؛ `i18n/navigation.ts` جدا؛ **زبان پیش‌فرض: فارسی**.
- `layout.tsx` مطابق Next 16 (`params` Promise، `hasLocale`، `generateStaticParams`، `setRequestLocale`)؛ فونت‌های Geist و Vazirmatn با `next/font`.
- `sw.js` حذف شد؛ Prettier + اسکریپت‌های `typecheck` و `format`؛ `.env.example`.

**راه‌اندازی جدید**
```bash
docker compose up -d
cd server && npm i && npm run db:migrate && npm run db:seed && npm run dev
cd client && npm i && npm run dev
```

### 2026-09-28 — فاز ۱ تمام شد ✅
**Server**
- ساختار ماژولار: `src/modules/{projects,tasks,scheduling}` با لایه‌های `domain / application / infrastructure / http`؛ پوشه‌های قدیمی `domain/`، `application/`، `infrastructure/`، `interfaces/` حذف شدند.
- `shared/http/handle.ts`: wrapper که params/query/body را با Zod parse و ورودی تایپ‌شده به handler می‌دهد (جایگزین controller + validate middleware).
- **امنیت:** body همه‌ی endpointها `.strict()` است ⇒ mass assignment بسته شد؛ هیچ `any` در کد باقی نمانده.
- ماژول `tasks` فقط از طریق interface `ProjectLookup` به `projects` وابسته است (مرز ماژول با ESLint کنترل می‌شود).
- `modules/scheduling/domain`: بازنویسی `Graph` (یال ورودی و خروجی)، `topologicalSort` (Kahn، O(V+E) با صف بدون `shift`)، `hasCycle`، **`wouldCreateCycle`** (DFS برای چک قبل از افزودن dependency — آماده برای فاز ۴) و `calculateCriticalPath` (generic، اعتبارسنجی duration منفی و گره ناشناخته).
- Endpointها: `GET/POST /projects/:projectId/tasks` و `GET /projects/:projectId` اضافه شدند؛ `POST /tasks` و `GET /tasks/project/:id` حذف شدند. وضعیت `Review` حالا در سرور معتبر است.
- تست: ۱۶ تست (۷ unit برای الگوریتم‌ها + ۹ integration با Supertest روی دیتابیس جدای `projectmanagement_test` که خودکار ساخته و migrate می‌شود).

**Client**
- ساختار `features/{projects,tasks,members,settings}/{api,hooks,components,schemas,types.ts,index.ts}`؛ `components/layout` و `components/shared`؛ `lib/{api-client,query-client,query-keys,format}.ts`؛ `hooks/use-error-message.ts`.
- صفحه‌ها Server Component و نازک شدند؛ هیچ `useQuery` در `app/` نیست.
- فرم‌ها با react-hook-form + Zod (پیام خطا ترجمه‌شده)؛ toast با sonner؛ Skeleton/Empty/Error state برای همه‌ی لیست‌ها.
- Kanban: حذف کپی state؛ جابه‌جایی optimistic روی cache با rollback و toast خطا؛ شناسایی ستون مقصد type-safe.
- **i18n کامل صفحات موجود** (fa/en)، اعداد و تاریخ‌ها با ارقام فارسی و **تقویم شمسی** (`Intl` با `fa-IR-u-ca-persian`)؛ RTL با کلاس‌های logical؛ منوی موبایل از سمت راست در فارسی.
- دکمه‌های بی‌عملکرد Bell و User و تنظیمات دکوری notification حذف شدند (در فاز ۲ و ۵ برمی‌گردند)؛ لینک Members به sidebar اضافه شد.
- رفع باگ shadcn CLI (`from "cn"`) و اضافه شدن `form`, `select`, `textarea`, `skeleton`, `sonner`, `tooltip`, `separator`.

**تأیید**
- `lint` + `typecheck` + `test` سرور و `lint` + `typecheck` + `build` کلاینت سبز.
- تست مرورگر (Playwright + Edge): نمایش خطای validation، ساخت تسک از dialog، drag از «To Do» به «Review» و ذخیره در DB؛ بدون خطای console. اسکرین‌شات RTL داشبورد و بورد بررسی شد.

**باقی‌مانده‌ی آگاهانه** (طبق برنامه در فازهای بعد): `authorId` موقتاً از client (فاز ۲)؛ لینک Calendar و داده‌ی mock صفحه‌ی Members (فاز ۳).

### 2026-09-28 — فاز ۲ تمام شد ✅
**Database** — migration `20260928100000_auth_and_membership`
- `User` بازطراحی شد (email/passwordHash/name/avatarUrl/locale/theme)؛ جدول‌های `RefreshToken` و `ProjectMember` (+ enum `ProjectRole`)؛ `Team`/`ProjectTeam`/`TaskAssignment` حذف شدند؛ `onDelete` صریح و index روی FKها.
- **migration داده‌ای دستی:** کاربر قدیمی حفظ شد (`admin` → `admin@example.local`، بدون رمز تا seed آن را تنظیم کند)، پروژه‌های بدون owner به اولین کاربر رسیدند و owner هر پروژه به‌عنوان `OWNER` عضو شد. هیچ داده‌ای از دست نرفت.
- seed جدید: `admin@example.com` (OWNER) و `sara@example.com` (MEMBER) — جزئیات در README.

**Server**
- ماژول‌های `auth` و `users`. access token = JWT HS256 (۱۵ دقیقه، cookie httpOnly)؛ refresh token = رشته‌ی تصادفی ۲۵۶ بیتی که فقط HMAC-SHA256 آن در DB ذخیره می‌شود (۷ روز، cookie با `Path=/auth`).
- **Refresh token rotation + reuse detection:** هر refresh یک‌بارمصرف است؛ استفاده‌ی دوباره از توکن قدیمی (بعد از پنجره‌ی ۱۵ ثانیه‌ای برای race بین تب‌ها) کل session family را باطل می‌کند. revoke به‌صورت اتمیک (`updateMany ... where revokedAt IS NULL`).
- bcrypt (cost 12) + مقایسه با hash ساختگی برای کاربر ناموجود (جلوگیری از user enumeration با زمان پاسخ)؛ rate-limit روی register/login (۲۰ درخواست / ۱۵ دقیقه).
- همه‌ی endpointهای پروژه و تسک پشت `requireAuth`؛ `authorId`/`ownerId` فقط از session. کاربر غیرعضو ⇒ 404، نقش ناکافی ⇒ 403 `INSUFFICIENT_ROLE`. `ProjectDto.myRole` اضافه شد.
- env: `JWT_ACCESS_SECRET`، `JWT_REFRESH_SECRET` (حداقل ۳۲ کاراکتر، بدون مقدار پیش‌فرض)، `ACCESS_TOKEN_TTL_MINUTES`، `REFRESH_TOKEN_TTL_DAYS`.
- تست‌ها: ۲۲ تست (۶ تست auth: ثبت‌نام، cookieهای httpOnly، ایمیل تکراری، خطای عمومی login، rotation و reuse detection، logout؛ و تست نقش‌ها VIEWER/غریبه).

**Client**
- route groupها: `(auth)/login`، `(auth)/register` (layout مینیمال با تغییر زبان و تم) و `(app)/*` پشت `AuthGuard`.
- `features/auth`: API، hookها (`useCurrentUser`, `useLogin`, `useRegister`, `useLogout`)، فرم‌های ورود/ثبت‌نام با Zod، `UserMenu` در Navbar (نام، ایمیل، تنظیمات، خروج).
- `api-client`: refresh خودکار و بی‌صدا روی 401 با **single-flight** (یک refresh برای همه‌ی درخواست‌های هم‌زمان) و retry؛ پشتیبانی از race بین تب‌ها؛ `onUnauthorized` برای بازگشت به صفحه‌ی ورود. هیچ توکنی در localStorage نیست.
- redirect امن بعد از ورود (`?next=` فقط مسیر نسبی — جلوگیری از open redirect).
- کاربر VIEWER دکمه‌ی «تسک جدید» را نمی‌بیند و drag برایش غیرفعال است.
- `DirectionProvider` برای Radix ⇒ منوها و selectها در فارسی درست راست‌چین می‌شوند. ارتقای client به Zod 4 (هم‌نسخه با server).

**تأیید**
- server: lint + typecheck + ۲۲ تست سبز؛ client: lint + typecheck + build سبز.
- تست مرورگر (Playwright/Edge) — همه موفق: redirect صفحه‌ی محافظت‌شده به `/fa/login?next=%2Fprojects`؛ پیام فارسی «ایمیل یا رمز عبور اشتباه است»؛ ورود و بازگشت به `next`؛ **حذف دستی access cookie ⇒ refresh بی‌صدا** و ماندن در صفحه؛ خروج از منوی کاربر و محافظت دوباره؛ ثبت‌نام با خطای رمز کوتاه و سپس موفق و دیدن حالت خالی برای کاربر جدید.
