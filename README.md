# ManageSys — Intelligent Project Management

A bilingual (Persian / English, RTL / LTR) project-management platform with Kanban boards, critical-path scheduling, real-time collaboration, notifications and AI assistance. It is a TypeScript monorepo: a Next.js client, an Express API and PostgreSQL.

[![CI](https://github.com/2az2000/IntelligentProjectManager/actions/workflows/ci.yml/badge.svg)](https://github.com/2az2000/IntelligentProjectManager/actions/workflows/ci.yml)

| Part | Stack |
|---|---|
| [`client/`](client/) | Next.js 16 (App Router), React 19, TanStack Query, shadcn/ui, Tailwind CSS 4, next-intl, dnd-kit, Socket.IO client |
| [`server/`](server/) | Express 5, TypeScript, Prisma 7 (`adapter-pg`), PostgreSQL 16, Zod 4, Socket.IO, BullMQ + Redis, pino |
| Infrastructure | Docker Compose (dev and production), Caddy (TLS + reverse proxy), GitHub Actions CI |

---

## Features

### Projects and tasks
- **Projects** with owner, dates, progress statistics and soft delete (with a recycling bin for tasks).
- **Roles per project:** `OWNER > ADMIN > MEMBER > VIEWER`. Non-members get a `404`, so the existence of other people's projects is never revealed.
- **Kanban board** with drag and drop (mouse and keyboard, with screen-reader announcements), fractional ordering inside columns and optimistic updates with rollback.
- **Custom workflow statuses** per project, plus a **list view** with sortable columns and shared filters.
- Task detail panel opened from any page via `?task=<id>` (shareable link): inline editing, subtasks with progress, tags/labels, priority, story points, estimates, due dates and multiple assignees.
- **Bulk actions**, project **templates**, and **comments** with @mentions and reactions.
- **Attachments** (size-limited, path-traversal-safe storage) and **time tracking** with project cost reports.

### Scheduling and analytics
- **Task dependencies** with cycle prevention, **critical path (CPM)** and slack calculation, working-week and holiday awareness (configurable weekend, default Thursday/Friday).
- **Timeline / Gantt** view with the critical path highlighted and a **predicted finish date**; Monte Carlo forecasting for the delivery date.
- **Reports:** burndown, workload and cost.
- **Workload heatmap** across everyone you share a project with, colour-coded by load.
- **My Tasks**, a month **calendar** (Persian/Jalali calendar for `fa`, Gregorian for `en`) and a personal **dashboard** (open, overdue, due this week, status breakdown, upcoming work).
- **Global search** across projects and tasks.

### Real-time and notifications
- **Socket.IO** rooms per project: live board updates, "who is online" presence and per-task viewers.
- **Notifications** (assignment, mentions, comments, due dates) with an unread badge, and an **activity log** per task.
- **Background jobs (BullMQ):** due-date reminders and a daily 08:00 digest e-mail. Disabled automatically when Redis is not available.

### AI assistance (optional)
Works with any OpenAI-compatible provider (default: OpenRouter). Without `AI_API_KEY` the AI endpoints answer `503 AI_NOT_CONFIGURED` and the rest of the app is unaffected.
- Task enrichment (description, subtasks, assignee suggestions, estimate), smart estimates from the team's closed tasks, tag suggestions, stand-up reports and thread summaries.
- Full **project documentation** generated as Markdown from the project's real data.
- Retry with back-off, model fallbacks and a second-provider fallback for busy free-tier models.

### Accounts and security
- Built-in auth: **JWT access token (15 min)** and an **opaque, rotating refresh token (7 days)**, both in `httpOnly` cookies; only an HMAC of the refresh token is stored. Reuse of a rotated token revokes the whole session family.
- bcrypt (cost 12) with timing-equalised login, rate limiting on credential endpoints, password reset by e-mail, profile and avatar upload, locale and theme saved per user.
- Strict Zod validation on every body (`.strict()`, no mass assignment), Helmet, CORS allowlist and an **Origin/Referer CSRF guard** for cookie auth, uniform error format `{ error: { code, message, details, requestId } }`.

### Internationalisation and UX
- Persian (default) and English everywhere, with logical CSS properties for correct RTL, Vazirmatn/Geist fonts, localized numbers, dates and relative times.
- Light/dark/system themes, skeleton/empty/error states on every data view, toast feedback, accessible dialogs and forms.

---

## Architecture

```
Browser ──► Caddy ─┬─► Next.js client           (/)
                   ├─► Express API              (/api/*)  ─► PostgreSQL
                   └─► Socket.IO                (/socket.io) ─► Redis (BullMQ jobs)
```

- **Server** is a modular monolith: `src/modules/<feature>/{domain,application,infrastructure,http}` with the dependency direction `http → application → domain ← infrastructure`. Modules talk to each other only through their `index.ts` (enforced by ESLint). Algorithms (graph, topological sort, critical path, ordering) are pure functions with unit tests.
- **Client** is feature-sliced: `src/features/<feature>/{api,hooks,components,schemas,types.ts,index.ts}`; pages are thin Server Components; all server state goes through TanStack Query hooks and one axios instance with single-flight silent token refresh.
- The client talks to the API over REST and axios (no Next.js Server Actions), so the API stays usable by other clients.
- Interactive API docs (Swagger UI) are served at `/docs` outside production. The committed [`openapi.json`](openapi.json) is generated from the same schemas and drives the client's API types; CI fails when either is stale.
- **Shared contract:** [`packages/contracts`](packages/contracts) holds the DTOs, vocabulary and payload rules both apps import, so a renamed field breaks `tsc` on both sides instead of a 400 in production. Task fan-out (socket + notifications) goes through a transactional outbox ([`server/src/modules/outbox`](server/src/modules/outbox)), so a crash after the commit cannot drop it.

The phased plan and change log are in [`docs/01-ROADMAP.md`](docs/01-ROADMAP.md).

---

## Getting started

**Prerequisites:** Node.js 22+, Docker Desktop.

```bash
# 1) Environment files (once)
cp .env.example .env                    # Postgres credentials for docker-compose
cp server/.env.example server/.env      # DATABASE_URL, JWT secrets, optional AI key
cp client/.env.example client/.env.local

# 2) Database (+ Redis for jobs) — Postgres is exposed on port 5433
docker compose up -d

# 3) Shared API contract (installed once; the app scripts rebuild it on dev/build)
cd packages/contracts
npm install
cd ../..

# 4) API  →  http://localhost:8000
cd server
npm install
npm run db:migrate      # apply migrations
npm run db:seed         # demo users and projects
npm run dev

# 5) Web  →  http://localhost:3000
cd client
npm install
npm run dev
```

Generate JWT secrets (at least 32 characters each):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Demo accounts (development only)

| E-mail | Password | Role |
|---|---|---|
| `admin@example.com` | `Admin@12345` | Owner of the sample projects |
| `sara@example.com` | `Sara@12345` | Member |
| `reza@example.com` | `Reza@12345` | Member / viewer |

> The seed is for local development. Never run it against a production database.

### Useful scripts

| Where | Command | Purpose |
|---|---|---|
| `server` | `npm run dev` | API with hot reload (`tsx watch`) |
| `server` | `npm run db:studio` | Prisma Studio at `http://localhost:5555` |
| `server` | `npm run db:deploy` | Apply migrations in production |
| `server` | `npm run openapi:dump` | Rewrite [`openapi.json`](openapi.json) from the live schemas |
| `client` | `npm run gen:api` | Regenerate [`api-types.ts`](client/src/lib/api-types.ts) from `openapi.json` |
| `packages/contracts` | `npm run dev` | Watch-build the shared contract while editing it |
| `server` | `npm test` | Unit + integration tests (uses a separate `<db>_test` database) |
| `client` | `npm test` | Vitest + Testing Library + MSW |
| `client` | `npm run test:e2e` | Playwright end-to-end suites |
| both | `npm run lint && npm run typecheck` | Static checks (also run in CI) |

> If the API exits with *"Port 8000 is already in use"*, an older instance is still running — stop it and start again. If you run the client on another port, add that origin to `CORS_ORIGIN` in `server/.env`.

---

## Configuration (server)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGIN` | Comma-separated allowed origins (also the CSRF allowlist) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Required, at least 32 characters, no defaults |
| `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS` | Session lifetimes |
| `RATE_LIMIT_PER_MINUTE` | Global rate limit |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Attachment storage and size cap |
| `WORKING_WEEKEND` | Weekend definition used by the scheduler |
| `REDIS_URL`, `JOBS_ENABLED` | BullMQ jobs (reminders, daily digest) |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_FALLBACK_*` | Optional AI provider and fallbacks |

---

## Production

`docker-compose.prod.yml` runs the whole stack behind Caddy with automatic HTTPS on a single origin: Caddy, client, API, PostgreSQL, Redis and a daily `pg_dump` backup job (14 backups retained).

```bash
cp .env.prod.example .env     # set PUBLIC_URL, DB credentials and JWT secrets
docker compose -f docker-compose.prod.yml up -d --build
```

Hosting notes:
- A single VPS running the compose file is the simplest fully-featured option (WebSockets, Redis, uploads on a real disk).
- Splitting the client and API across different domains needs same-site cookies (a shared parent domain or a proxy for `/api`), because auth uses `httpOnly` `SameSite=Lax` cookies and Socket.IO authenticates with the same cookie.
- Serverless/free tiers that do not support WebSockets or a persistent Redis will lose real-time features and background jobs.

---

## Quality

- **CI** (GitHub Actions): lint, typecheck, tests and build for client and server on every push and pull request.
- **Server:** Vitest unit tests (algorithms, domain rules) and Supertest integration tests per module (auth, tasks, scheduling, realtime, security, AI, …) against a dedicated test database.
- **Client:** Vitest and Testing Library with MSW, plus Playwright suites for the main flows (tasks, timeline, real-time).

## Roadmap

Phases 0–6 (foundation, restructuring, auth, feature completion, scheduling, real-time, production readiness) are complete; phase 7 (advanced features) is in progress. See [`docs/01-ROADMAP.md`](docs/01-ROADMAP.md) for the checklist and the change log.
