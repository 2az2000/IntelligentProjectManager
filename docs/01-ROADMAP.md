# ۰۱ — نقشه‌ی راه فازبندی‌شده (Roadmap)

> مبنا: [00-AUDIT.md](00-AUDIT.md) · ساختار هدف: [server](../server/docs/ARCHITECTURE.md) / [client](../client/docs/ARCHITECTURE.md) · API: [02-API-CONTRACT.md](02-API-CONTRACT.md)
>
> **قاعده:** فازها ترتیبی هستند. هر فاز فقط وقتی تمام است که همه‌ی موارد **Definition of Done** آن تیک خورده باشد.
> تخمین‌ها برای یک توسعه‌دهنده‌ی full-stack است.

## 📍 وضعیت فعلی

> **فاز جاری: فاز ۹ — بهبودها (در حال انجام)** · آخرین به‌روزرسانی: 2026-10-25
> این بخش بعد از اتمام هر فاز به‌روز می‌شود. جزئیات هر تغییر در [گزارش پیشرفت](#-گزارش-پیشرفت-changelog) انتهای همین سند.

| فاز | عنوان | هدف یک‌خطی | تخمین | وضعیت |
|---|---|---|---|---|
| ۰ | Foundation | پروژه با یک دستور بالا بیاید؛ ابزار کیفیت و ستون‌های backend آماده | ۳–۴ روز | ✅ تمام |
| ۱ | Restructure | کد فعلی به ساختار هدف منتقل شود، بدون تغییر رفتار | ۴–۵ روز | ✅ تمام |
| ۲ | Auth & Users | ورود/ثبت‌نام، عضویت در پروژه، حذف همه‌ی کاربرهای هاردکد | ۵–۶ روز | ✅ تمام |
| ۳ | Complete current features | هر دکمه، لینک و صفحه‌ی موجود واقعاً کار کند | ۱۰–۱۴ روز | ✅ تمام |
| ۴ | Smart scheduling | Dependencyها، CPM، Timeline/Gantt، فایل پیوست | ۷–۱۰ روز | ✅ تمام |
| ۵ | Real-time & Notifications | board زنده، اعلان، activity log، jobهای پس‌زمینه | ۶–۸ روز | ✅ تمام |
| ۶ | Production-ready | تست، CI/CD، Docker، امنیت، مستندات API | ۵–۷ روز | ✅ تمام (Sentry به بهبودها منتقل شد) |
| ۷ | Advanced features | تقویم شمسی، Command Palette، Workload heatmap، پیش‌بینی Monte Carlo، دستیار AI | ۱۰–۱۵ روز | ✅ تمام (چت پروژه، گزارش هفتگی، pgvector و Deadline Planner: 2026-10-19) |
| ۸ | Architecture & DX | contracts مشترک، تایپ از OpenAPI، outbox، tsconfig و imageهای مشترک | ۳–۴ روز | ✅ تمام (2026-10-24) |
| ۹ | Improvements | بستن شکاف‌های واقعی و پیشنهادهای باز [03-IMPROVEMENTS.md](03-IMPROVEMENTS.md) | مستمر | 🟡 در حال انجام (ایمیل و منطقه‌ی زمانی: 2026-10-24) |

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

### Database (migration: `20260930000000_dependencies_estimates` — اعمال‌شده)
- [x] `TaskDependency (predecessorId, successorId, type)` با `onDelete: Cascade` — enum `DependencyType` فعلاً فقط `FINISH_TO_START`؛ PK ترکیبی + index روی `successorId`.
- [x] `Task.estimateHours` (Float، 0..10_000، nullable).
- [x] `Attachment` کامل (mimeType، size، storageKey، createdAt، relation uploader) — migration `20261003000000_attachments_activity_notifications`.

### Server
- [x] `modules/scheduling`: `ScheduleService` — خواندن تسک‌ها + dependencyها ⇒ `CriticalPathEngine` ⇒ `ScheduleDto` (تسک DONE از مسیر خارج، unestimated تایمینگ null + `unestimatedTaskIds`؛ `applySchedule` فقط تاریخ‌های خالی/گذشته را با لنگر startDate پروژه پر می‌کند).
- [x] endpointهای dependency با جلوگیری از cycle (DFS `wouldCreateCycle` قبل از insert ⇒ 409 `DEPENDENCY_CYCLE`) و منع dependency بین پروژه‌ها + زیرتسک‌ها؛ `GET/POST /projects/:id/dependencies`، `DELETE .../:pre/:succ`، `GET/POST /projects/:id/schedule(/apply)`، `GET /tasks/:id/schedule`.
- [x] تبدیل duration به تاریخ واقعی (روزهای کاری؛ تعطیلی پنجشنبه/جمعه قابل تنظیم برای ایران) — `modules/scheduling/domain/work-calendar.ts` با `WORKING_WEEKEND` (hour-by-hour، roll-forward).
- [x] `modules/attachments`: آپلود با `multer` (memoryStorage + limit) به دیسک محلی در dev (`UPLOAD_DIR`، storageKey امن داخل پوشه)؛ stream دانلود با `Content-Disposition` و حذف فقط توسط uploader/ADMIN-OWNER (MinIO در فاز ۶ قابل جایگزینی است).

### Client
- [x] Task drawer: بخش «وابستگی‌ها» (وابسته به / مسدود می‌کند) با select تسک‌های پروژه — به‌جای جستجوی آزاد، select ساده با لیست نامزد‌ها (گام جستجو در فاز ۵ اختیاری است).
- [x] `projects/[projectId]/timeline`: Gantt دستی (CSS/SVG بدون کتابخانه‌ی خارجی — RTL-safe) با هایلایت مسیر بحرانی، قطعه‌ی slack، خطوط dependency، legend و دکمه‌ی «پر کردن تاریخ‌های خالی» (MEMBER+).
- [x] نمایش «تاریخ پایان پیش‌بینی‌شده» پروژه در هدر (badge، فقط وقتی تخمینی وجود دارد).
- [x] فیلد «تخمین (ساعت)» در CreateTaskDialog و TaskSheet ✓؛ آپلود/دانلود/حذف attachment در drawer ✓ (دکمه‌ی آپلود — drag & drop فایل به فاز بعد).

**✅ Definition of Done**
- [x] ساخت cycle از UI ممکن نیست و پیام واضح می‌دهد (toast ترجمه‌شده از کد `DEPENDENCY_CYCLE`).
- [x] Timeline برای پروژه‌ی seed مسیر بحرانی درست را نشان می‌دهد (تست واحد ✓ — ۶ تست کامپوننت/لایه؛ E2E ✓ — `e2e/phase4-timeline.spec.ts`: تخمین + dependency ⇒ duration/critical path/bars).

---

## فاز ۵ — Real-time، Notifications، Background jobs

- [x] docker-compose: سرویس `redis` (pm-redis)؛ `REDIS_URL` و `JOBS_ENABLED` در env (در test خاموش).
- [x] **Socket.IO**: احراز هویت handshake با cookie؛ room به ازای پروژه + user؛ انتشار `task:changed`/`comment:created`/`notification:new` پس از commit + presence map (`shared/realtime`).
- [x] Client: `useProjectSocket(projectId)` ⇒ invalidateQueries (tasks/schedule/dashboard/…)؛ `PresenceAvatars` «چه کسی آنلاین است» در هدر بورد/لیست.
- [x] **ActivityLog**: ثبت خودکار تغییرات تسک (diff روی TRACKED_FIELDS با snapshot قبل از applyChanges) در service؛ تایم‌لاین در drawer (`GET /tasks/:id/activity`).
- [x] **Notifications**: جدول + API (list/unread-count/read/read-all)؛ رویدادها: ASSIGNED، MENTIONED، COMMENTED، DUE_REMINDER (self-notify ممنوع؛ اکтер هرگز notified نمی‌شود).
- [x] **BullMQ**: job یادآوری dueDate (۲۴ ساعت قبل، jobId idempotent `due-N`)، digest ایمیل روزانه ۸ صبح (nodemailer jsonTransport + قالب fa/en)؛ graceful close.
- [x] Client: Bell با badge تعداد خوانده‌نشده + toast رویداد زنده، dropdown لیست، «همه خوانده شد»؛ toggle اعلان ایمیلی در Settings.
- [x] `@mention` در کامنت‌ها (`findMentions` روی memberهای پروژه، case-insensitive ⇒ MENTIONED).

**✅ Definition of Done**
- [x] دو مرورگر با دو کاربر: تسک ساخته‌شده توسط admin بدون refresh روی بورد sara دیده می‌شود (E2E `e2e/phase5-realtime.spec.ts`) + badge اعلان assign.
- [x] assign کردن تسک ⇒ اعلان فوری برای کاربر مقصد (integration + E2E bell).

---

## فاز ۶ — Production-ready

- [x] تست: پوشش domain/scheduling = ۹۴٪ (هدف ≥ ۸۰٪) ✓؛ integration برای همه‌ی endpointها ✓ (۸ تست امنیتی/docs در security.int + integrationهای فاز ۴/۵)؛ Playwright فاز ۳/۴/۵ ✓.
- [x] **CI (GitHub Actions)**: install → lint → typecheck → test (با Postgres service) → build، برای client و server + گیت `npm audit --omit=dev` (سطح critical برای server — ۲ high داخل وابستگی‌های prisma@7 است و فقط با downgrade؛ سطح high برای client — next به 16.3.8 ارتقا یافت).
- [x] **Docker**: Dockerfile چندمرحله‌ای برای server (non-root + healthcheck + `prisma migrate deploy` هنگام بوت) و client (`output: 'standalone'`)؛ `docker-compose.prod.yml` + Caddy با HTTPS خودکار؛ API پشت همان دامنه (`/api` + `/api/socket.io`) + سرویس `db-backup`.
- [x] **امنیت**: helmet با CSP (سازگار با Swagger UI)، CSRF با چک Origin/Referer روی متدهای ناامن (403 `CSRF_ORIGIN_MISMATCH`؛ مبنا: CORS_ORIGIN)، rate-limit سراسری `RATE_LIMIT_PER_MINUTE`، audit وابستگی‌ها در CI، محدودیت حجم body (۱MB از فاز ۰). Smoke واقعی: Origin شیطانی ⇒ 403.
- [x] **OpenAPI**: تولید از Zod (`@asteasolutions/zod-to-openapi`) + Swagger UI در `/docs` و `/docs.json` (فقط غیر production — در prod 404). اسکیماهای request همان Zodهای endpointها هستند ⇒ مستندات هرگز از کد عقب نمی‌ماند. ~۴۰ مسیر مستند شد.
- [x] لاگ JSON (pino + requestId، از فاز ۰) + healthcheck در Docker برای server/client/postgres/redis ✓ — **Sentry عمداً به فاز بهبودها منتقل شد** (نیاز به DSN و حساب سرویس دارد؛ راه‌حل عملی در [03-IMPROVEMENTS.md](03-IMPROVEMENTS.md)).
- [x] **PWA**: `manifest.webmanifest` + service worker (cache-first برای `/_next/static`، network-first برای صفحات، fallback به `offline.html` دوزبانه، هرگز `/api` و `/socket.io` را کش نمی‌کند) + ثبت فقط در build پروداکشن.
- [x] backup خودکار دیتابیس: سرویس `db-backup` (pg_dump -Fc هر ۲۴ ساعت، نگهداری ۱۴ نسخه‌ی آخر در `./backups`).

**✅ Definition of Done**
- [x] یک `docker compose -f docker-compose.prod.yml up` نسخه‌ی production را بالا می‌آورد — smoke واقعی: کلاینت 307 → fa، `/api/health` = ok، register/me با cookie، Swagger 404 در prod، CSRF 403 ✓ (HTTPS خودکار Caddy با دامنه‌ی واقعی فعال می‌شود).
- [x] هر PR بدون CI سبز قابل merge نیست (workflow روی push/PR به main).

---

## فاز ۹ — بهبودها (از [03-IMPROVEMENTS.md](03-IMPROVEMENTS.md))

**هدف:** دو چیز در یک جا — (۱) هر پیشنهادی از سند بهبودها که ساخته شد، به‌عنوان تاریخچه ثبت شود تا دوباره پیشنهاد نشود؛ (۲) کارهای باقی‌مانده چک‌لیست اجرایی داشته باشند.

### ۹.۱ اجراشده — پیشنهاد سند ← نتیجه در کد

| حوزه | پیشنهاد در سند | آنچه ساخته شد | فاز |
|---|---|---|---|
| معماری | DTO/واژگان مشترک بین دو اپ | `packages/contracts`: واژگان، سقف‌ها، DTOها و factoryهای zod؛ هر دو اپ همان‌ها را consume می‌کنند | ۸ |
| معماری | تایپ API از قرارداد، بدون drift | `openapi.json` از `/docs.json` + `api-types.ts` با `openapi-typescript` + سه assert `Equal` در `api-contract.ts` + گیت CI | ۸ |
| معماری | رخداد دامنه‌ی قابل اتکا | outbox تراکنشی (`DomainEvent`، `emit/on/drain/prune`، poller ۲ ثانیه‌ای) و انتقال fan-out تسک به subscriber | ۸ |
| DX | تنظیمات TypeScript مشترک | `tsconfig.base.json` در ریشه؛ سه پکیج فقط گزینه‌های مختص خود را دارند | ۸ |
| DX | image و CI قابل بازتولید | Dockerfileها از ریشه‌ی repo، `.dockerignore`، CI با cache و گیت OpenAPI/نوع‌ها | ۸ |
| Scheduling | پیش‌بینی احتمالاتی | Monte Carlo (P50/P85/P95) + نمایش در گزارش سه‌گانه | ۴/۷ |
| Scheduling | مسیر بحرانی | CPM + critical path در `scheduling/domain/schedule.ts` و Timeline | ۴ |
| Scheduling | «تا کِی تمام می‌شود؟» | Deadline Planner + سرویس `deadline-plan` | ۷ |
| Scheduling | ریسک پروژه | risk score در `analytics.service` | ۷ |
| Scheduling | تقویم کاری واقعی | تعطیلات ایران + `work-calendar` + محاسبه‌ی روز کاری | ۴ |
| Scheduling | تضاد تاریخ دستی با dependency | `date-conflicts.ts` + هشدار غیرمسدودکننده در PATCH | ۴ |
| Scheduling | توزیع بار تیم | workload heatmap + ظرفیت فردی + گزارش burndown/velocity | ۴ |
| Scheduling | پیشرفت خودکار و تسک بی‌صاحب | پیشرفت از زیرتسک‌ها، فهرست بدون صاحب و انتقال مالکیت | ۴ |
| AI | کمک هوشمند در جای‌های پرهزینه | enrich تسک، داکیومنت پروژه، چت با tool، خلاصه‌ی هفتگی/thread، برچسب خودکار، stand-up، جست‌وجوی معنایی pgvector | ۷ |
| UX | کار سریع‌تر با کیبورد | Command Palette ⌘K، میانبرها، ویرایش درجا، Bulk، جست‌وجوی سراسری | ۳ |
| UX | بورد قابل تنظیم | group-by در List، Saved Views، WIP limit، زیرتسک در popover | ۳/۴ |
| UX | نوشتن و برگشت‌پذیری | Rich text با sanitize، Undo در toast، سطل زباله، تور آنبوردینگ | ۳ |
| UX | شروع سریع پروژه | سه قالب پروژه + PWA + لندینگ | ۳/۶ |
| همکاری | گفتگو روی کار | کامنت + واکنش + mention autocomplete + presence سطح تسک | ۵/۷ |
| همکاری | اطلاع‌رسانی زنده | socket + اعلان درون‌برنامه + چندمسئولی + آواتار | ۵ |
| حساب | بازیابی رمز و داده | reset با توکن یک‌بارمصرف، time tracking + بودجه/هزینه، CSV export، soft-delete | ۲/۷ |
| عملیات | انتشار و پایش | CI چهارگانه + audit gate، compose prod با Caddy، backup روزانه، healthcheck، rate limit، origin guard، pgvector | ۶ |

> جمع‌بندی: تمام موارد بالا در [03-IMPROVEMENTS.md §۸](03-IMPROVEMENTS.md) هم فهرست شده‌اند؛ این جدول فقط نگاشت «پیشنهاد ← نتیجه» است.

### ۹.۲ باقی‌مانده — چک‌لیست اجرا

**اولویت ۱ — بستن شکاف‌های واقعی (از §۲ سند)**
- [x] **§۲.۱۰ منطقه‌ی زمانی و «امروز» درست** — `APP_TIME_ZONE`، helper واحد `dayBounds`، digest و cron واقعی + تست مرزی (2026-10-24).
- [x] **§۲.۱ ارسال واقعی ایمیل** — `shared/mail` با سه حالت smtp/json/off، کلیدهای `SMTP_URL`/`MAIL_FROM`/`MAIL_ENABLED`، وصل‌شدن reset و هر سه job (2026-10-24).
- [ ] **Sentry (کلاینت + سرور)** — نیاز به DSN؛ `captureException` در error-handler با `requestId`.
- [x] **E2E در CI** — job `e2e` با Postgres + migrate/seed + Chromium و آپلود trace؛ `/health` و کلاینت ۳۰۰۲ با `CORS_ORIGIN` درست، `JOBS_ENABLED=false` تا Redis لازم نباشد (2026-10-25).
- [ ] **ترجیحات per-type اعلان** — امروز فقط یک سوییچ `notifyEmail` هست؛ سوییچ جدا برای digest/یادآور/هفتگی (مدل سبک JSON روی `User`).

**اولویت ۲ — ارزش روی موجودی**
- [ ] **§۲.۲ خط پایه و انحراف (Baseline)** — `ScheduleBaseline` + snapshot از `buildSchedule` + variance + لایه‌ی Timeline.
- [ ] **§۲.۳ نقاط عطف (Milestone)** — مدل، progress از estimate، لوزی روی Timeline.
- [ ] **Auto-scheduling زنجیره‌ای** — تغییر تخمین/تاریخ تسک، پایین‌دست را با flag سرکوب به‌روز کند.
- [ ] **§۲.۴ Watch / Follow** — watcher برای تسک و پروژه و افزودن به گیرندگان اعلان.
- [ ] **§۲.۵ Web Push** — `PushSubscription` + `web-push` در worker + VAPID.
- [ ] **§۲.۶ فید ICS شخصی** — توکن قابل revoke + `GET /me/calendar.ics`.
- [ ] **§۲.۸ مدیریت نشست‌ها** — `GET /auth/sessions` + revoke؛ بدون migration جدید جز metadata.
- [ ] **§۲.۷ لینک اشتراک‌گذاری فقط‌خواندنی** — `ShareLink` با allow-list فیلد و expiry/revoke.

**اولویت ۳ — گزارش و دقت**
- [ ] **§۲.۹ گزارش وضعیت یک‌صفحه‌ای** — جمع‌کردن health + P85 + ریسک + انحراف + کارهای هفته + کپی Markdown.
- [ ] **AI: کالیبره‌کردن تخمین با TimeEntry** — «تخمین اولیه vs ساعت واقعی» per عضو.
- [ ] **§۲.۱۱ صف آفلاین PWA / Feature flag / اعتبارسنجی پاسخ در dev / axe / سهمیه‌ی پیوست / تمرین restore** — هر کدام S و مستقل.

> بقیه‌ی تصمیم‌های باز (§۳–§۶ سند: Sprint، Recurrence، Custom fields، Workspace، SSO، 2FA، pnpm/Turborepo، Storybook، Object storage، Sentry/OTel) در همان سند می‌مانند و تا وقتی مشتری/داده‌ی واقعی نباشد شروع نمی‌شوند — جز مواردی که در همین چک‌لیست بالا آورده شده‌اند.

---

## بعد از فاز ۹
پیشنهادهای توسعه‌ی بعدی در [03-IMPROVEMENTS.md](03-IMPROVEMENTS.md).

**داکیومنت‌های یادگیری (فاز ۷):** مسیر آموزشی پروژه — [`server/LEARNING.md`](../server/LEARNING.md) و [`client/LEARNING.md`](../client/LEARNING.md)؛ هر ماژول/فیچر `LEARNING.md` خودش را دارد (الگوها، سینتکس، تمرین).

---

## 📝 گزارش پیشرفت (Changelog)

### 2026-10-25 — فاز ۹: E2E در CI و هدر جدید بورد

**E2E در CI**
- job سوم (`e2e`) روی `pgvector/pgvector:pg16` (دیتابیس dev، نه test) با `db:deploy` + `db:seed` بالا می‌آید، Chromium را نصب می‌کند و سه مسیر فاز ۳/۴/۵ را روی سرورهای واقعی اجرا می‌کند؛ trace و اسکرین‌شات شکست آپلود می‌شوند.
- `JOBS_ENABLED=false` چون این job Redis ندارد و صف فقط نویز retry می‌ساخت؛ `CORS_ORIGIN` به ۳۰۰۲ تنظیم شد تا origin guard درخواست‌های واقعی را ۴۰۳ نکند.
- در `playwright.config.ts` مهلت بالا آمدن هر سرور ۱۸۰ ثانیه و مهلت هر تست در CI ۶۰ ثانیه شد؛ دلیلش هزینه‌ی اولین compile در `next dev` است، نه کندی خود تست.

**هدر بورد**
- هدر پروژه یک‌ردیفه شد: عنوان + پیل نسخه، خط «پایان پیش‌بینی‌شده»، توضیح و بازه‌ی تاریخ، و سوییچر پیل‌مانند نماها (تب فعال بنفش) مطابق اسکرین‌شات تأییدشده؛ «گفتگو با پروژه» به نوار ابزار بورد رفت تا قابلیت حذف نشود.

**فرانت:** برچسب گم‌شده‌ی `Activity.fields.statusKey` اضافه شد؛ قبلاً جابه‌جایی کارت در تاریخچه، مسیر خام کلید ترجمه را نشان می‌داد و در کنسول `MISSING_MESSAGE` می‌ریخت.

### 2026-10-24 — فاز ۸: معماری و DX (contracts، OpenAPI types، Outbox، tsconfig مشترک)

**پکیج مشترک `@managesys/contracts`**
- `packages/contracts`: واژگان (`TASK_STATUSES`/`TASK_PRIORITIES`/`PROJECT_ROLES`)، سقف‌ها (عنوان، تگ، توضیح، HTML، امتیاز، تخمین) و DTOهای `TaskDto`/`ProjectDto`/`ActivityPage` حالا یک منبع حقیقت‌اند؛ سرور همان‌ها را برمی‌گرداند و کلاینت همان‌ها را تایپ می‌کند.
- payloadها به‌صورت factory نوشته شدند (`createTaskPayloadSchema(z)`): هر اپ schema را با zod خودش می‌سازد. اگر پکیج خودش zod را import می‌کرد، `instanceof ZodError` در error-handler و `extendZodWithOpenApi` روی دو کلاس جدا می‌افتادند.
- اتصال با `file:../packages/contracts` (بدون بازنویسی نصب/لاک‌فایل دو اپ)؛ `predev/prebuild/pretypecheck` آن را build می‌کند. Dockerfileها حالا از ریشه‌ی repo build می‌شوند و CI هم contracts را نصب و build می‌کند.
- `error-handler` حالا `ZodError` را duck-type می‌کند (شکل یکسان، کلاس متفاوت).

**Type-safe API از OpenAPI**
- `server/scripts/dump-openapi.ts` + `npm run openapi:dump` سند `/docs.json` را در `openapi.json` ریشه می‌نویسد.
- کلاینت با `openapi-typescript` آن را به `src/lib/api-types.ts` تبدیل می‌کند (`npm run gen:api`).
- `src/lib/api-contract.ts` سه assert دقیق (`Equal`) دارد: `Task`، `Project` و `ActivityPage` تولیدشده باید دقیقاً با DTOهای contracts یکی باشند؛ هر drift یک خطای `tsc` است.
- به همین دلیل `TaskSchema`/`ProjectSchema` سند OpenAPI کامل شدند (project/author/assignee/assignees/timestamps/warnings/stats) — قبلاً با DTO واقعی فاصله داشتند.
- CI: سند و تایپ‌های تولیدشده باید به‌روز باشند (`git diff --exit-code`).

**Outbox**
- جدول `DomainEvent` (migration `20261024120000_phase8_outbox`) + `modules/outbox`: `emit` (با پشتیبانی از transaction client)، `on`، `drain`، `prune` (۷ روز).
- fan-out تسک (socket + اعلان `ASSIGNED`) از hook به subscriberهای outbox منتقل شد؛ request بعد از emit همان‌جا `drain` می‌کند تا تأخیر قبلی حفظ شود و poller ۲ ثانیه‌ای در `main.ts` فقط تور ایمنی کرش است.
- ۶ تست integration: publish، retry + `lastError`، `MAX_ATTEMPTS`، rollback تراکنشی، prune و سیم‌کشی واقعی روی `POST` تسک.

**tsconfig مشترک**
- `tsconfig.base.json` در ریشه؛ server/client/contracts فقط گزینه‌های مختص خودشان را نگه می‌دارند.

**Docker (ریشه‌ی repo به‌عنوان context)**
- هر دو image حالا `docker build -f server/Dockerfile .` (یا client) از ریشه build می‌شوند؛ `.dockerignore` اضافه شد. client و server روی یک base (`node:22-slim`) هستند تا باینری‌های native بین build/runtime قاطی نشوند.
- باگ واقعی که در smoke-test پیدا شد: runtime سرور روی `/app/node_modules` می‌نشست ولی symlink نسبی npm (`node_modules/@managesys/contracts -> ../../../packages/contracts`) برای `/app/server` ساخته شده بود، پس image با `MODULE_NOT_FOUND` بالا نمی‌آمد. ساختار runtime حالا آینه‌ی build است (`/app/server` + `/app/packages/contracts`).

**تأیید:** `typecheck`/`lint` هر دو اپ سبز · server ۲۲۱ تست (۳۴ فایل) و client ۱۰۹ تست (۲۳ فایل) سبز · `npm run build` سرور سبز · image کلاینت بالا آمد و `/fa/login` را ۲۰۰ داد · image سرور روی یک Postgres تمیز (pgvector) migrate شد و `/health` = ۲۰۰ و `/auth/login` = ۴۰۰ (اعتبارسنجی) · `openapi.json` و `api-types.ts` بازتولید شدند و بدون diff ماندند.
- ⚠️ `next build` محلی روی ویندوز با dev-server در حال اجرا (`EBUSY` روی `.next`) شکست می‌خورد؛ build پروداکشن در image تأیید شد. برای build محلی اول `npm run dev` کلاینت را ببند.

**باقی‌مانده‌ی آگاهانه:** pnpm + Turborepo، Storybook و CQRS سبک داشبورد.

### 2026-10-23 (۲) — تاریخچه فعالیت: صفحه‌ی ۸تایی + «نمایش موارد بیشتر»

- **مسئله:** تایم‌لاین تسک همه‌ی ردیف‌ها را یک‌جا می‌گرفت؛ یک ویرایش چندفیلدی چند ردیف می‌سازد و تاریخچه‌ی تسک‌های قدیمی شیت را به یک دیوار متن تبدیل می‌کرد.
- قرارداد: `GET /tasks/:taskId/activity?limit=8&cursor=<id>` حالا `{ items, nextCursor, total, people }` برمی‌گرداند — `limit` پیش‌فرض ۸ (حداکثر ۵۰) و صفحه‌بندی keyset روی id، پس صفحه‌ها بدون offset و بدون تکرار/جاافتادگی‌اند. `total`/`people` (count + groupBy) روی کل تاریخچه حساب می‌شوند تا خلاصه‌ی هدر با هر صفحه عوض نشود. سند قرارداد: [02-API-CONTRACT.md](02-API-CONTRACT.md).
- کلاینت: هوک `useActivity` به `useInfiniteQuery` تبدیل شد، `getNextPageParam` از `nextCursor` می‌آید و تایم‌لاین فقط ۸ ردیف اول را نشان می‌دهد؛ دکمه‌ی «نمایش موارد بیشتر» صفحه‌ی قدیمی‌تر را اضافه می‌کند (حین fetch غیرفعال، در صفحه‌ی آخر پنهان). گروه‌بندی روزانه و diff فیلدها دست‌نخورده ماندند.
- **تأیید:** تست جدید سرور (۸ ردیف، `nextCursor`، صفحه‌ی دوم ۲ ردیف و جدا از صفحه‌ی اول، `limit=25` همه را برمی‌گرداند) و دو تست کامپوننت (۸ → کلیک → ۱۰ و حذف دکمه؛ پنهان‌بودن دکمه وقتی همان ۸ کافی است)؛ تست‌های realtime/assignees به شکل صفحه به‌روز شدند. بررسی زنده: شیت تسک با ۸ ردیف و دکمه‌ی «نمایش موارد بیشتر» بالا آمد و کلیک آن ردیف‌های قدیمی‌تر را اضافه کرد.

### 2026-10-23 — §۴ Productivity و UX کامل شد (نمایش سریع زیرتسک در بورد)

- **آخرین آیتم نیمه‌کاره‌ی §۴:** badge «۳/۵ زیرتسک» روی کارت بورد حالا دکمه است؛ popover همان‌جا لیست زیرتسک‌ها را نشان می‌دهد (آیکن انجام/باز، خط‌خوردگی روی انجام‌شده‌ها) و کلیک روی هر زیرتسک همان sheet را باز می‌کند.
- `GET /tasks/:id` فقط زمانی صدا زده می‌شود که popover باز باشد (کامپوننت فقط در mount باز نصب می‌شود)، پس هزینه‌ی شبکه‌ی بورد تغییر نمی‌کند. شمارش `done/total` از payload فهرست می‌آید و قبل از fetch هم دیده می‌شود.
- badge داخل کارت کلیک‌پذیر و drag sensor است؛ `stopPropagation` روی click/pointerdown تضمین می‌کند باز کردن popover نه کارت والد را باز کند نه درگ را شروع کند.
- بقیه‌ی §۴ از قبل پیاده شده بود: میانبرها (`useTaskShortcuts`)، Command Palette، ویرایش درجا + Bulk، جست‌وجوی سراسری، group-by و Saved Views، WIP limit، Rich text، Undo، تور آنبوردینگ.
- **تأیید:** ۳ تست جدید (`task-card.test.tsx`: شمارش قبل از fetch، باز شدن لیست زیرتسک‌ها، باز کردن زیرتسک بدون باز شدن کارت والد، و Enter روی badge بدون باز شدن کارت والد)؛ کل تست‌های کلاینت ۱۰۷/۱۰۷ سبز؛ `tsc --noEmit` سبز؛ eslint روی فایل‌های تغییریافته بدون خطا.

---

### 2026-10-20 — هشدار تضاد تاریخ دستی با dependencyها (§۴ Productivity و UX)

- **مسئله:** dependency می‌گوید «بالادست قبل از شروع پایین‌دست تمام می‌شود»، ولی PATCH هر تاریخی را می‌پذیرفت و CPM فقط تاریخ‌های خالی را پر می‌کند — تضاد تا بازبینی دستی Gantt دیده نمی‌شد.
- `scheduling/domain/date-conflicts.ts`: گذر transitively روی زنجیره (تسک میانیِ بی‌تاریخ هم دیده‌شدن A→C را نمی‌بندد)، نادیده‌گرفتن تسک‌های DONE در دو طرف، حداکثر ۳ هشدار به ترتیب شدت (`conflictDays`)؛ همان‌روز hand-off معتبر است.
- `ScheduleService.findDateWarnings` روی همان `loadScheduleInput`، وصل‌شده با hook `tasks.service.hooks.dateWarnings`. فقط وقتی `startDate`/`dueDate` در PATCH آمده باشد اجرا می‌شود و خطایش write را نمی‌شکند (فقط `logger.warn`).
- قرارداد: پاسخ `PATCH /tasks/:taskId` حالا `warnings[]` اختیاری دارد (`DEPENDENCY_DATE_CONFLICT`، `direction: predecessor|successor`، تسک مرتبط، روزهای هم‌پوشانی)؛ بدون تضاد کلید حذف می‌شود، پس کلاینت قدیمی چیزی نمی‌بیند.
- UI: بنر کهربایی در TaskSheet با متن انسانی، دکمه‌ی «باز کردن» تسک متضاد و بستن. چون بدنه‌ی Sheet با `updatedAt` remount می‌شود، `useUpdateTask` هشدارها را در کش مختص خودشان (`qk.taskWarnings`) می‌نویسد و Sheet از آنجا می‌خواند — onSuccess سطح mutate در این remount از دست می‌رفت (تست واقعی در مرورگر همین را نشان داد).
- **تأیید:** سرور ۲۰۰/۲۰۰ (۷ تست واحد date-conflicts + ۳ تست integration روی PATCH: هشدار، جهت معکوس، سکوت برای ویرایش بی‌تاریخ/تاریخ سازگار/همسایه‌ی DONE)، کلاینت ۹۸/۹۸ (۳ تست بنر + ۳ تست ثبت/پاک‌کردن هشدار در کش)؛ `tsc` و lint هر دو سبز؛ سناریوی واقعی در مرورگر: تاریخ متضاد ⇒ بنر با نام تسک و روزهای تضاد، «باز کردن» ⇒ تسک متضاد، بستن ⇒ پاک‌شدن بنر.

---

### 2026-10-19 — فاز ۷ کامل شد: چت پروژه، گزارش هفتگی، جست‌وجوی معنایی، Deadline Planner

**AI chat با پروژه — خواندن بدون نوشتن**
- `POST /projects/:projectId/ai/chat` (VIEWER+): snapshot ساختاریافته از پروژه، اعضا و بار کاری، تسک‌های باز، وابستگی‌های مسدودکننده و ActivityLog هفت روز؛ نقش پرسش‌کننده در snapshot می‌آید ولی ابزار نوشتن وجود ندارد، پس VIEWER هم پاسخ می‌گیرد و هیچ‌چیز تغییر نمی‌کند.
- تاریخچه با دو سقف محدود می‌شود (۱۲ نوبت و ۱۶k کاراکتر؛ Zod آخرین پیام را `user` می‌خواهد) تا پنجره‌ی مدل رایگان و سهمیه‌ی کاربر با پیام‌های قدیمی نسوزد.
- UI: دکمه‌ی «چت پروژه» در هدر پروژه (Sheet کنار صفحه در RTL)، سه پرسش نمونه، Enter=ارسال، پاک کردن گفتگو و toast خطای ترجمه‌شده.

**گزارش هفتگی پروژه — یک متد، دو مسیر**
- تولید گزارش از داده‌ی واقعی هفت روز (`completed/created/open/overdue/blocked/activity/activeMembers` + تسک‌های سرآمد و بلاکرها) در متد مشترک سرویس؛ `POST /projects/:id/ai/weekly-summary` همیشه برای پیش‌نمایش در دسترس است.
- job دوشنبه ۰۸:۰۰ (BullMQ) روی همان متد: برای هر پروژه‌ی دارای فعالیت/تحویل، به ازای هر زبان اعضا **یک** فراخوانی مدل، سپس اعلان `WEEKLY_SUMMARY` و ایمیل برای اعضای `notifyEmail`؛ شکست یک پروژه بقیه را متوقف نمی‌کند.
- `NotificationDto` حالا `projectId/projectName` دارد (ردیف‌های سطح پروژه)؛ Bell با کلیک روی گزارش به تنظیمات همان پروژه می‌رود.
- UI: کارت «خلاصه‌ی هفتگی با AI» در تنظیمات پروژه با آمار، پیش‌نمایش Markdown و کپی.

**جست‌وجوی معنایی با pgvector**
- migration `20261019000000_add_task_embeddings`: `Task.embedding vector(1536)` + ایندکس HNSW با فاصله‌ی کسینوسی؛ `docker-compose` و CI به `pgvector/pgvector:pg16` سوییچ کردند (همان volume قبلی).
- embed خودکار fire-and-forget فقط وقتی عنوان/توضیح تغییر کند؛ `POST /projects/:id/ai/embeddings/backfill` برای تسک‌های قدیمی (۲۰۰ مورد، بچ ۱۶تایی، idempotent).
- `GET /search` هیبرید شد: نتایج کلمه‌ای اول، سپس نزدیک‌ترین embeddingهایی که کلمه پیدا نکرده (`match: 'semantic'` + `similarity`)؛ همه‌چیز محدود به پروژه‌های عضو. بدون کلید یا با خطای ارائه‌دهنده، جست‌وجو کلمه‌ای می‌ماند و `semantic.reason` دلیل را می‌گوید (`not_configured`/`provider_error`) — هرگز ۵۰۰.
- UI: کلید جرقه در جعبه‌ی جست‌وجوی سراسری (opt-out)، badge تطابق معنایی، و کارت وضعیت/بک‌فیل در تنظیمات پروژه.

**تقویم Deadline Planner — معکوس CPM**
- `GET /projects/:id/plan?by=&confidence=50|85|95`: بازه‌ی کاری بین امروز و تاریخ هدف (با احترام به آخر هفته و تعطیلات رسمی) منهای بودجه‌ی Monte Carlo همان صدک؛ اختلاف یک buffer است که همه‌ی گره‌های CPM را جابه‌جا می‌کند، پس یال‌های finish-to-start معتبر می‌مانند.
- خروجی صریح است: `feasible`، `bufferHours/bufferWorkingDays`، آخرین شروع/پایان هر تسک و `mustStartNow[]`؛ buffer منفی پنهان نمی‌شود و تاریخ‌ها به anchor کلمپ می‌شوند تا «از قبل عقب افتاده» دیده شود.
- UI: کارت «برنامه‌ریز معکوس» بالای Gantt با date picker شمسی، انتخاب P50/P85/P95، badge شدنی/نشدنی، فهرست «باید امروز شروع شود» و جدول آخرین شروع/پایان.

**بهبودهای همراه**
- Command Palette (`⌘K`/`Ctrl+K`): ناوبری، پرش به پروژه، جست‌وجوی تسک و تغییر تم در یک لیست با کیبورد — بدون وابستگی جدید؛ دکمه‌ی راهنما در Navbar.
- دیالوگ «شکستن PRD به تسک» (`BreakdownDialog`) در بورد: پیش‌نمایش با انتخاب تسک‌ها، ساخت از مسیرهای عادی و اتصال dependencyهای ایندکسی.
- پرش کامنت‌های جست‌وجوی سراسری حالا از `projectId` واقعی استفاده می‌کند (قبلاً پروژه‌ی ۱ هاردکد بود).

**تأیید:** `tsc` سرور/کلاینت سبز؛ lint سرور بدون خطا و کلاینت بدون error (۲ warning قدیمی React Compiler)؛ تست‌های جدید — ۷ واحد ریاضیات planner، ۵ chat/summary، ۴ pgvector search/backfill (stub یک-hot با ۱۵۳۶ بعد)، ۴ endpoint plan و ۱ اعلان سطح پروژه؛ **سرور ۱۹۰/۱۹۰**، **کلاینت ۹۲/۹۲**، build هر دو موفق. جزئیات قرارداد و DTOها در [02-API-CONTRACT.md](02-API-CONTRACT.md).

---

### 2026-10-18 (۲) — همکاری: واکنش به کامنت، منشن هوشمند، حضور سطح تسک

**واکنش به کامنت — سیگنال بدون نویز**
- مدل `CommentReaction` با کلید یکتای `(commentId, userId, emoji)`؛ این کلید خودش «هر کس برای هر
  emoji یک رأی» را تضمین می‌کند، پس شمارنده هرگز نمی‌تواند drift کند.
- یک endpoint **toggle** (`POST /comments/:id/reactions`) به‌جای POST/DELETE جدا: یک تپ = یک
  درخواست، و دوبار کلیک سریع به‌جای ردیف تکراری، واکنش را برمی‌دارد. پاسخ همان لیست گروه‌بندی‌شده
  است تا کلاینت با یک منبع حقیقت کار کند.
- گروه‌بندی سمت سرور انجام می‌شود (نه در کلاینت): هر دو صفحه (drawer و هر جای دیگر که thread را
  نشان دهد) یک عدد می‌بینند. `users` نام‌ها را می‌آورد تا tooltip «چه کسی» بدون درخواست دوم ساخته
  شود، و ترتیب chipها ثابت است تا با اولین واکنش جابه‌جا نشوند.
- واکنش عمداً **اعلان نمی‌سازد** — فقط `comment:reaction` روی سوکت می‌رود و thread خودش را
  invalidate می‌کند. هر 👍 یک نوتیف شدن، دقیقاً همان نویزی است که reactions برای حذفش وجود دارند.
- Allowlist شش emoji هم در Zod و هم در UI؛ یک ردیف آزاد یعنی نوار کامنت به یک picker کامل تبدیل
  می‌شود و payload هم بزرگ.
- کلاینت optimistic است (`lib/reactions.ts`, تابع خالص): chip در همان فریم تپ عوض می‌شود، پاسخ
  سرور جایگزینش می‌شود و در خطا rollback می‌کند.

**منشن هوشمند — از حافظه به انتخاب**
- منطق در `lib/mentions.ts` و خالص است: `mentionQuery` (کجا `@` باز می‌شود، تا کجا ادامه دارد)،
  `filterMentionCandidates` و `applyMention` (جایگزینی + موقعیت caret).
- `@` فقط بعد از فاصله یا ابتدای متن باز می‌شود تا ایمیل (`sara@example`) منشن حساب نشود؛ اسم‌های
  چندکلمه‌ای پشتیبانی می‌شوند چون سرور `@Full Name` را literal match می‌کند و قرارداد تغییر نکرد.
- کیبورد کامل: ↑/↓ حرکت، Enter/Tab درج، Esc بستن؛ `onMouseDown` تا blur قبل از کلیک dropdown را
  نبندد. نتیجه: `@نام` تایپ‌شده با دست، تبدیل به انتخاب از لیست اعضای پروژه می‌شود.

**حضور سطح تسک — قبل از ویرایش بدانید تنها نیستید**
- presence قبلی فقط «چه کسی در پروژه آنلاین است» بود؛ حالا `task:join/leave` هم داریم و سرور
  `${projectId}:${taskId}` را **per socket** می‌شمارد. شمارش per socket عمدی است: یک نفر با دو تب
  باز، با بستن یکی از tabها از چشم دیگری غیب نمی‌شود.
- join فقط بعد از `project:join` پذیرفته می‌شود، پس چک عضویت دقیقاً در یک جا می‌ماند (room پروژه).
  روی `connect` دوباره announce می‌شود تا بعد از reconnect وضعیت گم نشود، و روی disconnect همه‌ی
  ردیف‌های آن socket پاک می‌شوند.
- UI: آواتار بقیه بالای TaskSheet با متن «n نفر دیگر این تسک را باز کرده‌اند»؛ خود کاربر نمایش داده
  نمی‌شود (بی‌فایده و گیج‌کننده).

**آنچه از دسته‌ی «همکاری» عمداً انجام نشد**
- ویرایش هم‌زمان با Yjs، پورتال مهمان (نقش GUEST)، ربات تلگرام/بله، اتصال GitHub، webhookهای
  خروجی و Import از Trello/Jira. دلیل: هر کدام یک سطح جدید (CRDT/سرور جدا، مدل دسترسی جدید،
  صف و HMAC و retry) اضافه می‌کنند و با هم در یک گام قابل بازبینی نیستند؛ در
  [03-IMPROVEMENTS.md](03-IMPROVEMENTS.md) §۵ با وضعیت باقی‌مانده ثبت شده‌اند.

**تأیید:** `comment-reactions.int.test.ts` (۴ تست: toggle/گروه‌بندی/ترتیب، allowlist و عدم عضویت،
cascade، منشن فقط برای مخاطب و نه نویسنده) · `mentions.test.ts` (۶ تست) · `reactions.test.ts`
(۵ تست) · server ۲۵ فایل/۱۶۹ تست + lint/typecheck · client ۱۱ فایل/۳۳ تست lib + typecheck.

---

### 2026-10-18 — چند مسئول برای یک تسک، نقشه‌ی بار کاری، و برد با drag & drop واقعی

**چند مسئول (multi-assignee) — «مالکیت» و «همکاری» دو چیز جدا هستند**
- تصمیم اصلی: `Task.assigneeId` **حذف نشد**. یک تسک یک **مسئول اصلی (lead)** دارد و بقیه در
  جدول `TaskCollaborator` می‌نشینند. دلیل: مسئول اصلی همان چیزی است که CPM، یادآور سررسید و
  «چه کسی پاسخگوست» به آن تکیه می‌کنند؛ اگر همه در یک آرایه‌ی یکسان می‌شدند، گزارش‌ها یا باید
  «اولین عضو آرایه» را حدس می‌زدند یا ساعت هر مسئول را کسری می‌کردند. API آرایه‌ی **مرتب**
  `assigneeIds` می‌گیرد (index 0 = lead) و هر دو نمای `assignee`/`assignees` را برمی‌گرداند تا
  کد قدیمی نشکند.
- یکتایی: `@@unique([taskId, userId])`. سرور موقع نوشتن، lead را از فهرست همکاران حذف و
  همکاران را به همان ترتیب ورودی ذخیره می‌کند؛ پس «lead هم به‌عنوان همکار» اصلاً ذخیره نمی‌شود
  (این حالت هم اعلان تکراری می‌داد و هم در heatmap ساعت را دو بار می‌شمرد). عضویت همه‌ی idها در
  پروژه در لایه‌ی سرویس اعتبارسنجی می‌شود، نه در Zod، چون به DB نیاز دارد.
- اعلان و یادآور برای **همه**ی مسئول‌ها یکسان است، ولی اکتر هرگز اعلان خودش را نمی‌گیرد (قاعده‌ی
  فاز ۵). «کارهای من»، digest روزانه و یادآور سررسید با
  `assigneeId = me OR collaborators contains me` کوئری می‌شوند — یک تعریف واحد برای «کار من» تا
  شمارنده‌ی داشبورد با لیست اختلاف پیدا نکند.
- بار کاری: تسک مشترک **کامل** برای هر مسئول شمرده می‌شود (نه تقسیم بر تعداد). این عمدی است:
  وقتی سه نفر روی یک تسک‌اند ظرفیت هر سه درگیر است و تقسیم ساعت‌ها هشدار بیش‌بار را پنهان می‌کرد.
- کلاینت: `features/tasks/lib/assignees.ts` تنها جایی است که ترتیب مسئول‌ها تغییر می‌کند
  (`toggleAssignee` / `promoteAssignee` / `knownAssignees`) تا picker و payload هرگز واگرا نشوند.
  picker داخل TaskSheet آواتارها + نام مسئول اصلی + «n همکار» دارد، «مسئول اصلی کن» دارد و حذف
  مسئول اصلی نفر بعدی را ارتقا می‌دهد. کارت برد همه‌ی آواتارها را با حلقه‌ی تأکید روی lead نشان
  می‌دهد و فیلتر «مسئول» با همکاران هم match می‌کند.
- تست: `task-assignees.int.test.ts` (نوشتن/پاک‌سازی lead، یکتایی، عدم عضویت، اعلان به همه) +
  `assignees.test.ts` (invariantهای ترتیب) + به‌روزرسانی `use-tasks.test.tsx`.

**نقشه‌ی حرارتی بار کاری + هشدار بیش‌بار (بهبود #۴)**
- مسئله: برای «چه کسی هفته‌ی آینده می‌سوزد؟» داده‌ی روزانه وجود ندارد؛ تسک فقط بازه‌ی
  شروع/سررسید و تخمین ساعت دارد. راه‌حل: هر تسک باز به نسبت **هم‌پوشانی بازه‌اش با هر هفته** بین
  همان هفته‌ها پخش می‌شود (`modules/projects/application/workload.ts` — تابع خالص، بدون DB و
  بدون خواندن ساعت سیستم، پس مستقیم تست‌پذیر است).
- دو تصمیم ظریف: (۱) بازه با `max(start, now)` بریده می‌شود، پس کار عقب‌افتاده تمام فشارش را روی
  **هفته‌ی جاری** می‌گذارد — همان سیگنالی که نقشه برای آن ساخته شده؛ (۲) هفته‌ها از **شنبه** شروع
  می‌شوند (اولین روز کاری ایران، هم‌راستا با `WORKING_WEEKEND`)، نه دوشنبه‌ی تقویم میلادی.
- ظرفیت: پیش‌فرض `WEEKLY_CAPACITY` (۴۰ ساعت) و override هر عضو با
  `ProjectMember.capacityHoursPerWeek`؛ نسبت ≥۱۱۰٪ قرمز، ≥۸۰٪ کهربایی. `GET /me/team/workload`
  و `GET /projects/:id/workload` هر دو از همان تابع استفاده می‌کنند تا داشبورد و صفحه‌ی اعضا یک
  عدد بدهند.
- UI: ماتریس عضو × هفته با ستون چسبانِ نام؛ کلیک روی هر خانه فهرست تسک‌های همان هفته را
  (سنگین‌ترین اول) باز می‌کند تا «بیش‌بار» فوراً به «چه چیزی را جابه‌جا کنم» تبدیل شود؛ بج
  «n نفر بیش‌بار» بالای کارت و بج هشدار در هدر Timeline. اعداد بومی‌سازی‌شده و رنگ‌ها فقط تزئینی
  (با `aria-label` متنی).
- تست: `workload.test.ts` (مرز هفته، برش با now، پخش متناسب، تسک بدون تخمین) +
  `workload-heatmap.test.tsx` (رندر ماتریس، شمارش بیش‌بار، باز شدن جزئیات خانه).

**برد: drag & drop از پایه درست شد**
- ریشه‌ی «اصلاً کار نمی‌کند»: کارتِ در حال درگ اسلات خودش را هم به‌عنوان droppable زنده نگه
  می‌دارد؛ با `closestCorners` نزدیک‌ترین گوشه همان اسلات خودش بود، پس `over` هرگز ستون دیگری
  نمی‌شد و رها کردن عملاً no-op می‌شد. حالا `pointerWithin` اول بررسی می‌شود (کارت زیر اشاره‌گر
  ⇒ جای دقیق، وگرنه ستون زیر اشاره‌گر ⇒ انتهای ستون) و `closestCorners` فقط fallback درگ
  کیبوردی است.
- به‌جای «پرش» در لحظه‌ی رها کردن، یک **پیش‌نمایش** از مقصد در state نگه داشته می‌شود و کارت
  همان‌جا رندر می‌شود؛ حرکت بین ستون‌ها پیوسته دیده می‌شود و همان چیزی که کاربر می‌بیند مبنای
  محاسبه‌ی drop است (`planDropAtIndex`) — نه چیزی که collision در آخرین میلی‌ثانیه حدس می‌زند.
- علاوه بر آن: `TouchSensor` با تأخیر ۱۸۰ms (تا اسکرول روی موبایل کارت را برندارد)، آستانه‌ی
  ۶px برای PointerSensor (کلیک هنوز کلیک بماند)، fallback برای تسکی که ستونش هم‌زمان حذف شده، و
  اعلام‌های صفحه‌خوان با نام وضعیت‌های همان پروژه.
- تست: `kanban-board.test.tsx` (درگ بین ستون‌ها و فراخوانی `move` با پوزیشن درست) + رفع سه spec
  قدیمی `phase3`/`phase4`/`phase5` که مسیرهای `/app` را دنبال نمی‌کردند.

**مسیرها و تم (تکمیل کارهای نیمه‌تمام)**
- همه‌ی صفحات اپ زیر `/{locale}/app/…` جمع شدند (گروه `(app)` به سگمنت واقعی `app` تبدیل شد) تا
  layout عمومی (لندینگ) و layout اپ از هم جدا بمانند؛ `proxy.ts`، sidebar، جست‌وجوی سراسری و
  E2Eها هم‌راست شدند.
- تم روشن/تاریک/سیستم به یک provider + `ThemeScript` بدون فلش منتقل شد؛ انتخاب کاربر در
  `localStorage` می‌ماند و `data-theme` پیش از hydration ست می‌شود.

**تأیید:** server ۲۴ فایل/۱۶۵ تست + lint/typecheck · client ۹ فایل/۵۱ تست + lint (۰ error) و
typecheck · نقشه‌ی حرارتی و picker چند‌مسئولی در مرورگر بررسی شدند.

---

### 2026-10-13 — برچسب‌های ساختارمند پروژه، وضعیت‌های دلخواه برد، گزارش کامل تسک و خلاصه‌ی روزانه‌ی غنی‌تر

**برچسب‌های ساختارمند (per-project vocabulary)**
- سرور: ماژول `labels` + migration `add_project_labels` — هر پروژه یک واژگان برچسب دارد (نام + رنگ `#rrggbb` + آیکون از لیست مجاز). `GET/POST/PATCH/DELETE /projects/:projectId/labels`؛ واژگان فقط ADMIN تغییر می‌کند و VIEWER می‌خواند. نام برچسب یکتا است (`409 LABEL_EXISTS`) و **تغییر نام، همان tag را روی تسک‌های همان پروژه بازنویسی می‌کند** تا فیلتر/خروجی/AI دست‌نخورده بمانند؛ حذف برچسب tagهای تسک را پاک نمی‌کند.
- کلاینت: `features/labels` (chip با آیکون و رنگ، `LabelPicker` برای فیلد تسک، `LabelManager` در تنظیمات پروژه با پالت رنگ/آیکون و «افزودن مجموعه‌ی پیشنهادی»)، نمایش chip روی کارت‌های برد. تست: `labels.int.test.ts` (۵ تست).

**وضعیت‌های دلخواه برد با ترتیب**
- سرور: ماژول `statuses` + migration `add_project_statuses`. هر پروژه با چهار ستون پیش‌فرض ساخته می‌شود و می‌تواند وضعیت دلخواه اضافه کند: `{ label, color, category, afterKey? }` — `afterKey` وضعیت را **بلافاصله بعد از** ستون خواسته‌شده جا می‌دهد (مثلاً QA بعد از Dev و قبل از Review) و `position` فاصله‌دار بازنویسی می‌شود. `reorder` کل ترتیب را می‌نویسد؛ حذف ستونی که تسک دارد بدون `?moveToKey=` رد می‌شود؛ `category` تعیین می‌کند زمان‌بندی/داشبورد آن ستون را در کدام سبد بشمارد و تغییرش تسک‌های ستون را دوباره دسته‌بندی می‌کند.
- تسک‌ها باز هم `statusKey` دارند و `status` از `category` همان ستون مشتق می‌شود؛ `move`، فیلترها و bulk همه با `statusKey` کار می‌کنند بنابراین برد کاملاً داینامیک شد. تست: `statuses.int.test.ts` (۸ تست).

**گزارش تسک — از تیتر به گزارش واقعی**
- `TaskReport` در drawer تسک حالا شش عدد کلیدی (وضعیت، پیشرفت زیرتسک‌ها، زمان ثبت‌شده/تخمین با نوار، سررسید، شناوری و مسیر بحرانی، وابستگی‌ها) به‌علاوه‌ی ردیف «چه چیزی نیاز به اقدام دارد» می‌دهد: عقب‌افتادگی با تعداد روز، بدون مسئول، بدون تخمین، مصرف بیش از تخمین، مسدود بودن توسط پیش‌نیازها، بحرانی بودن، رکود (۱۴ روز بدون تغییر)، تعداد نظرات و بازه‌ی ساخت/آخرین تغییر.
- تخمین AI حذف شد (فیلد دستی «تخمین (ساعت)» باقی است)؛ ساعت‌های ثبت‌شده‌ی تایمر همچنان در همان گزارش می‌آید.

**خلاصه‌ی روزانه‌ی غنی‌تر**
- `GET /dashboard/digest` حالا علاوه بر کارهای امروز/عقب‌افتاده، این‌ها را هم دارد: `dueThisWeek`، `inProgress`، `completedSinceYesterday`، سن قدیمی‌ترین کار عقب‌افتاده (`overdueByDays`) و شکست به تفکیک پروژه (`perProject`). هر ردیف تسک `overdueByDays`/`daysUntilDue` دارد تا مودال و ایمیل ۰۸:۰۰ از یک payload رندر شوند. تست‌ها در `profile-digest.int.test.ts`.

**تایمرها، هزینه و ۴۰۴ گزارش هزینه**
- `/projects/:projectId/cost` (گزارش هزینه‌ی پروژه) و `/tasks/:taskId/time*` + `/me/timer` + `/me/time-summary` روی سرور مستند و فعال‌اند؛ خطای گزارش‌شده‌ی «`Route GET /projects/23/cost not found`» از سرورِ قدیمیِ در حال اجرا بود — روی همان پروژه `200` می‌دهد و همین در بررسی زنده تأیید شد.

**تاب‌آوری AI (خطای «سرویس هوش مصنوعی در دسترس نیست»)**
- تلاش دوباره با backoff (`AI_RETRY_ATTEMPTS`/`AI_RETRY_BASE_MS`)، عبور از زنجیره‌ی `AI_FALLBACK_MODELS` و امکان ارائه‌دهنده‌ی دوم (`AI_FALLBACK_*`)؛ کول‌داون `429` در UI با شمارنده‌ی فارسی و پیام plural درست.

**رفع باگ‌های کنسول و i18n**
- `<script>` تم به یک Server Component (`ThemeScript`) منتقل شد تا React خطای «Encountered a script tag» ندهد؛ `deleteTitle` پارامتر `{title}` را می‌گیرد؛ پیام `docRateLimited` به plural کامل (`other`) رسید. کلاینت: `eslint` بدون خطا، `tsc --noEmit` سبز.

**تأیید:** server ۱۴۷/۱۴۷ + typecheck · client ۶۷/۶۷ + lint/typecheck · بررسی زنده در مرورگر روی پروژه‌ی ۲۳: ساخت ستون «QA» بعد از In Progress از تنظیمات (position = ۲۵۶۰ دقیقاً بین ۲۰۴۸ و ۳۰۷۲) و دیدن آن در برد کنار در حال انجام، باز شدن واژگان برچسب پروژه با آیکون و رنگ اختصاصی در فیلد برچسب تسک، گزارش کامل تسک، و مودال خلاصه‌ی روزانه با شش شاخص و تفکیک پروژه؛ هیچ خطای کنسولی از React یا i18n. ستون آزمایشی QA پس از بررسی حذف شد.

---


### 2026-10-10 — بازبینی UX: تصویر پروفایل، داکیومنت پروژه با AI، نوتیف خلاصه‌ی روزانه + رفع باگ آپلود

**تصویر پروفایل — چند مسیر به‌جای فقط URL**
- سرور: `POST /users/me/avatar` (multipart، png/jpeg/webp/gif، حداکثر ۲MB؛ نام فایل UUID سمت سرور) و `GET /avatars/:fileName` عمومی با `Cache-Control: public, max-age=31536000, immutable` و `Cross-Origin-Resource-Policy: cross-origin`؛ آپلود جدید فایل قبلی را حذف می‌کند و نام‌های خارج از الگوی UUID رد می‌شوند. نیز پاک کردن یا تغییر آدرس (`avatarUrl: null`) فایل ذخیره‌شده را از دیسک حذف می‌کند (تست جدید در `profile-digest.int.test.ts`).
- کلاینت: در Settings کاربر چهار مسیر هست — انتخاب فایل، دوربین موبایل (`capture="user"`)، کشیدن‌و‌رها کردن تصویر روی کارت (با هایلایت)، و آدرس URL؛ به‌علاوه «حذف تصویر». `avatarSrc` مسیرهای نسبی `/avatars/…` را به مبدأ API نگاشت می‌کند تا `<img>` نشکند.

**داکیومنت پروژه با AI — در تنظیمات هر پروژه**
- کارت تولید داکیومنت از Settings کاربر به **تنظیمات همان پروژه** منتقل شد (`features/ai/components/project-doc-card.tsx` ← `ProjectSettings`)؛ endpoint همان `POST /projects/:id/ai/project-doc` است و فقط پیش‌نمایش Markdown برمی‌گرداند.

**خلاصه‌ی روزانه به‌صورت نوتیف**
- `GET /dashboard/digest` (کارهای امروز/عقب‌افتاده + پروژه‌ی هرکدام، فقط پروژه‌های خود کاربر)؛ نوتیف `DAILY_DIGEST` در زنگ اعلان‌ها حالا دیالوگ گزارش را باز می‌کند (`features/dashboard/components/digest-dialog.tsx`) به‌جای لینک بی‌مقصد.

**رفع باگ آپلود پیوست**
- ریشه‌ی باگ: هدر پیش‌فرض `Content-Type: application/json` در `api-client`، axios را وادار می‌کرد بدنه‌ی `FormData` را به JSON تبدیل کند. حالا هدر پیش‌فرض حذف شده و axios خودش JSON یا multipart+boundary می‌گذارد.
- تست‌ها: jsdom 30 نماد داخلی Blob را حذف کرده و پل jsdom↔undici در vitest برای هر بدنه‌ی multipart («Failed to read a Blob as bytes») می‌شکست؛ در `src/test/setup.ts` رجیستری idl جی‌اس‌دام زیر همان کلیدی که vitest می‌خواند بازگردانده شد (روی jsdomهای سازگار no-op است).

**مسیرها** — صفحات اپ زیر `/{locale}/app/…` جمع شدند و لینک‌های `/app` در ناوبری/جست‌وجو/منو همراست شدند.

**تأیید:** server ۱۲۰/۱۲۰ + typecheck · client ۶۷/۶۷ + typecheck/lint · بررسی زنده در مرورگر: آپلود فایل، drag & drop با هایلایت، سرو شدن تصویر (۲۰۰ + `image/png` + immutable)، حذف تصویر، و حضور کارت داکیومنت در تنظیمات پروژه. تولید واقعی داکیومنت در بررسی زنده به 429 ارائه‌دهنده خورد (محدودیت نرخ OpenRouter رایگان) و درست به‌صورت `AI_PROVIDER_ERROR` نمایش داده شد.

---

### 2026-10-06 — فاز ۷ (گام دوم): §۱۱ کامل + heatmap + a11y + سوییچ AI به OpenRouter

**§۱۱ حساب کاربری و چرخه‌ی داده**
- فراموشی رمز: مدل `PasswordResetToken` (HMAC، ۱ ساعت، یک‌بارمصرف، reuse ⇒ ابطال بقیه)؛ `POST /auth/forgot-password` (همیشه 204) و `POST /auth/reset-password` (revoke همه‌ی نشست‌ها)؛ ایمیل jsonTransport در dev؛ صفحات `/forgot-password` و `/reset-password` با i18n + لینک در فرم لاگین؛ ۸ تست integration جدید.
- سطل زباله: `GET /projects/:id/tasks/trash` + `POST .../trash/:taskId/restore` (نویسنده/ADMIN؛ زیرتسک‌های هم‌حذف برمی‌گردند)؛ کارت سطل زباله در Project Settings.
- قالب پروژه: سه قالب آماده؛ `GET /projects/templates` + `POST /projects/from-template` (پورت `templateApply` ⇒ ساخت از مسیر tasks/scheduling با همان دسترسی/رویدادها)؛ select قالب در دیالوگ پروژه‌ی جدید.

**§۶ مدیریت منابع** — صفحه‌ی تیم ⇒ workload heatmap (نسبت به پرکارترین عضو: ≤۵۰٪ سبز، ≤۸۵٪ کهربایی، بالاتر قرمز + legend).

**§۱۰ طراحی و برند** — گام اول a11y: skip-link سراسری + `id="main-content"`.

**AI** — ارائه‌دهنده‌ی پیش‌فرض از Groq (تحریم IP ایران) به **OpenRouter رایگان** (`deepseek/deepseek-v3.2-exp:free`) تغییر کرد؛ فیکس retry بدون response_format. `.env.example` آپدیت شد (یک کلید اشتباهی‌واردشده حذف گردید).

**تأیید:** server 102/102 + lint + typecheck؛ client 67/67 + lint + build. داکیومنت‌های `LEARNING.md` طبق تصمیم، لوکال (git-ignored) ماندند و از ریپو حذف شدند.

**باقی‌مانده‌ی §۶/§۱۰/§۱۱:** time tracking، export شمسی، burndown، بقیه‌ی a11y (axe audit)، تأیید ایمیل، GDPR، recurrence، هشدار تضاد تاریخ.

---

### 2026-10-06 — فاز ۷ (گام اول): AI با مدل رایگان + داکیومنت‌های یادگیری

**Database**
- migration `20261006085423_add_member_skills`: `ProjectMember.skills String[] @default([])` (تخصص‌ها؛ ورودی AI برای پیشنهاد assignee).

**Server**
- ماژول `modules/ai` (همان factory pattern): `POST /projects/:id/ai/enrich-task` (پیش‌نمایش: توضیح، زیرتسک، پیشنهاد assignee با دلیل، تخمین) و `POST /projects/:id/ai/project-doc` (داکیومنت کامل Markdown)؛ هر دو **فقط پیش‌نمایش** (هیچ writeی) و preview-then-apply.
- LLM با `fetch` روی **هر endpoint سازگار OpenAI** — بدون SDK؛ پیش‌فرض Groq رایگان (`llama-3.3-70b-versatile`)؛ Google AI Studio / OpenRouter فقط با تغییر env (`AI_API_KEY/AI_BASE_URL/AI_MODEL/AI_TIMEOUT_MS`). بدون کلید ⇒ 503 `AI_NOT_CONFIGURED` و بقیه‌ی اپ سالم.
- امنیت/کیفیت: خروجی مدل با Zod validate؛ assignee غیرعضو حذف؛ rate limiter اختصاصی (10/min)؛ timeout با AbortController؛ کدهای `AI_PROVIDER_ERROR/AI_BAD_RESPONSE/AI_TIMEOUT`؛ ثبت در OpenAPI (tag: AI).
- `updateMember` (role و/یا skills؛ self یا ADMIN) جایگزین updateMemberRole؛ skills در addMember؛ `MemberDto.skills`.
- **تست: ۹۴/۹۴ سبز** (۷ تست جدید integration AI با fetch stub) + typecheck + lint.

**Client**
- `features/ai` (api/hooks/types)؛ دکمه‌ی «تکمیل با هوش مصنوعی» در CreateTaskDialog — فقط فیلدهای خالی پر می‌شوند، زیرتسک‌های پیشنهادی چک‌باکس‌دار و در submit واقعاً ساخته می‌شوند، دلیل پیشنهاد هر assignee نمایش داده می‌شود.
- کارت «تولید داکیومنت پروژه با AI» در Settings (select پروژه + پیش‌نمایش Markdown + کپی)؛ ویرایشگر skills در ProjectMembers (self/ADMIN).
- i18n کامل fa/en (Tasks/Members/Settings + ۴ کد خطای جدید)؛ MSW handlerهای AI + POST tasks؛ ResizeObserver polyfill در setup تست.
- **تست: ۶۷/۶۷ سبز** (تست جریان کامل AI) + typecheck + lint + build.

**Docs (یادگیری)**
- ۱۸ فایل `LEARNING.md`: نقشه‌ی شروع در ریشه‌ی هر دو اپ + داکیومنت آموزشی داخل ماژول‌ها/پوشه‌های کلیدی (الگوها، سینتکس، تمرین‌های تدریجی) — [server/LEARNING.md](../server/LEARNING.md) · [client/LEARNING.md](../client/LEARNING.md).

**باقی‌مانده‌ی فاز ۷:** Command Palette، heatmap، Monte Carlo، تقویم شمسی، breakdown چندتسکی AI از PRD.

---

### 2026-10-05 — فاز ۶ (Production-ready) تمام شد ✅

**CI**
- `.github/workflows/ci.yml`: برای server (lint/typecheck/test با سرویس Postgres 16/build/audit) و client (lint/typecheck/build/audit) — هر PR و push به main.
- `npm audit fix` اعمال شد؛ `next` → 16.3.8 (رفع critical DoS/request smuggling)؛ `@prisma/client` هم‌تراز با CLI در 7.10.0 (رفع خطای wasm در بیلد Docker).

**امنیت (server)**
- `origin-guard.ts`: چک Origin/Referer روی POST/PUT/PATCH/DELETE ⇒ 403 `CSRF_ORIGIN_MISMATCH` (آزمون‌شده در تست و استک واقعی).
- rate-limit سراسری (`RATE_LIMIT_PER_MINUTE=300`، skip در test و /health) + limiter قبلی احراز هویت.
- helmet با CSP سفارشی برای سازگاری Swagger UI.
- index.ts هر ماژول اسکیماهای HTTP را هم export می‌کند (مرز ماژول‌ها حفظ).

**OpenAPI**
- `shared/openapi.ts` با zod-to-openapi: ~۴۰ مسیر، اسکیماهای DTO و Error؛ Swagger UI در `/docs` + `/docs.json` فقط خارج production.
- ۸ تست جدید (security.int.test.ts): هدرهای helmet، گارد CSRF (۵ حالت)، اعتبار سند OpenAPI.

**رفع باگ race نوتیفیکیشن/اکتیویتی (Prisma 7.10)**
- hookهای `tasks.onChanged` و `comments.onCreated` حالا awaitable‌اند و composition root در `app.ts` آن‌ها را await می‌کند ⇒ اکتیویتی و نوتیفیکیشن قبل از پاسخ HTTP ثبت می‌شوند (BullMQ همچنان fire-and-forget). `activity.record` هم async شد.

**Docker + Production stack**
- `server/Dockerfile` (چندمرحله‌ای، non-root، healthcheck، migrate deploy در بوت، کپی prisma.config.ts) و `client/Dockerfile` (standalone، non-root، healthcheck، build args `/api`).
- `docker-compose.prod.yml`: caddy + client + server + postgres + redis (AOF) + **db-backup** (pg_dump روزانه، ۱۴ نسخه)؛ `deploy/Caddyfile` (مسیر `/api` و `/socket.io`)؛ `.env.prod.example`.
- Smoke واقعی: health ok، register/me با cookie، Swagger 404، CSRF 403، db-backup فعال.

**کلاینت**
- `output: standalone`؛ PWA (manifest + sw.js + offline.html + ثبت production-only)؛ socket به مسیر نسبی `/api/socket.io` پشت پراکسی متصل می‌شود؛ `NEXT_PUBLIC_SOCKET_PATH` جدید.
- تأیید: typecheck/lint سبز (همان ۱ warning قدیمی)، **۶۶/۶۶ تست**، build موفق، **۶/۶ E2E** سبز.

**server**: typecheck/lint سبز، **۸۷/۸۷ تست**، coverage مسیر بحرانی scheduling = ۹۴٪ (هدف فاز: ≥۸۰٪).

**باقی‌مانده‌ی آگاهانه از فاز ۶:** Sentry (به 03-IMPROVEMENTS منتقل شد) و سوییچ storage پیوست‌ها به MinIO (اختیاری؛ دیسک محلی با volume کار می‌کند).

### 2026-10-04 — فاز ۴ کامل شد ✅ + فاز ۵ کامل شد ✅

**Server**
- migration `20261003000000_attachments_activity_notifications`: بازنویسی Attachment، ActivityLog (index [taskId,createdAt])، Notification، User.notifyEmail.
- `work-calendar`: روزهای کاری ایران (WORKING_WEEKEND پیش‌فرض پنجشنبه/جمعه) در buildSchedule/applySchedule؛ ۹ تست واحد.
- ماژول‌های activity / attachments / notifications / jobs (BullMQ + nodemailer) با factory pattern؛ bus تایپ‌شده + لایه Socket.IO (handshake با cookie، roomهای project/user، presence).
- hooks: tasks.onChanged ⇒ activity + broadcast + ASSIGNED + scheduleDueReminder؛ comments.onCreated ⇒ COMMENTED/MENTIONED. رفع باگ mutation در applyChanges (snapshot قبل از اعمال).
- تأیید: typecheck/lint سبز، **۷۹/۷۹ تست** (۱۳ فایل، شامل ۸ تست integration realtime/attachments/activity/notifications).

**Client**
- `features/realtime` (socket singleton + useProjectSocket/useProjectPresence + PresenceAvatars)، `features/notifications` (Bell با badge/dropdown/mark-all + toast زنده)، `features/activity` (تایم‌لاین drawer با diff ترجمه‌شده)، `features/attachments` (آپلود/دانلود/حذف در drawer).
- toggle اعلان ایمیلی در Settings؛ qkهای notifications/activity/attachments؛ i18n کامل fa/en (۴ namespace جدید + NOTIFICATION_NOT_FOUND).
- E2E: `phase4-timeline.spec.ts` (تخمین+dependency ⇒ CPM) و `phase5-realtime.spec.ts` (دو مرورگر: بورد زنده + bell)؛ فیکس locator مبهم phase3.
- تأیید: typecheck سبز، lint بدون خطا (۱ warning قدیمی)، **۵۳/۵۳ تست** (۱۳ فایل)، E2E فاز ۳/۴/۵ سبز، build موفق.

### 2026-10-03 — فاز ۴ (سcheduling) server + client اصلی تمام شد — attachments باقی است

**Database** — migration دستی `20260930000000_dependencies_estimates`: `Task.estimateHours` + `TaskDependency` (PK ترکیبی، cascade، index) + enum `DependencyType`. روی dev اعمال شد؛ تست‌ها خودکار migrate می‌کنند.

**Server**
- `buildSchedule` خالص روی `CriticalPathEngine`: DONEها duration صفر، unestimatedها تایمینگ null و خارج از مسیر بحرانی؛ `scheduledStart/Finish` از startDate دستی + es.
- `ScheduleService` (project/task/apply) و `DependencyService` با `assertLinkable` (خودتسک/زیرتسک/پروژه‌ی متفاوت ⇒ 400) و 409 برای cycle/existence.
- seed: تخمین‌ها + زنجیره‌ی نمایشی idempotent (top-up برای دیتابیس‌های قدیمی). قرارداد API به‌روز شد (فقط لوکال).
- تأیید: typecheck/lint سبز، **۶۲/۶۲ تست** (۱۱ فایل، شامل ۱۱ تست integration scheduling)، smoke واقعی روی :8000 (duration 64، مسیر بحرانی [4,5,6]).

**Client**
- ماژول `features/scheduling` (api/hooks/lib/types) + صفحه‌ی `projects/[projectId]/timeline`: Gantt دستی CSS/SVG با مسیر بحرانی، slack، خطوط وابستگی، legend، دکمه‌ی apply؛ badge «پایان پیش‌بینی‌شده» در هدر پروژه.
- فیلد «تخمین (ساعت)» در CreateTaskDialog و TaskSheet؛ بخش «وابستگی‌ها» در drawer (افزودن/حذف با toast خطاهای ترجمه‌شده).
- i18n کامل fa/en؛ رفع بمب ساعتی تست `is-overdue` (تاریخ‌ها حالا نسبت به ساعت سیستم).
- تأیید: typecheck سبز، lint بدون خطا، **۴۸/۴۸ تست** (۸ فایل)؛ smoke مرورگر: timeline پروژه‌ی seed مسیر بحرانی درست (وایرفریم→لندینگ→QA، ۶۴ ساعت، ۳ تسک بحرانی) و drawer/dependencyها بدون خطای console.

**باقی‌مانده‌ی فاز ۴:** attachments (migration + MinIO + drawer) و تبدیل duration به روزهای کاری ایران؛ E2E برای timeline.

---

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
