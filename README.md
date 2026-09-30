# Intelligent Project Management (ManageSys)

سیستم مدیریت پروژه‌ی دو‌زبانه (فارسی/انگلیسی) با Kanban، زمان‌بندی مبتنی بر مسیر بحرانی (CPM) و — در آینده — همکاری real-time و دستیار هوش مصنوعی.

| بخش | تکنولوژی |
|---|---|
| [`client/`](client/) | Next.js 16، React 19، TanStack Query، shadcn/ui، Tailwind 4، next-intl |
| [`server/`](server/) | Express 5، TypeScript، Prisma 7، PostgreSQL 16، Zod |

## راه‌اندازی

پیش‌نیاز: Node.js 22+، Docker Desktop.

```bash
# 1) تنظیمات محیطی (یک بار)
cp .env.example .env                    # اطلاعات Postgres برای docker-compose
cp server/.env.example server/.env      # DATABASE_URL و JWT secretها را پر کنید
cp client/.env.example client/.env.local

# 2) دیتابیس (Postgres 16 روی پورت 5433)
docker compose up -d

# 3) Backend  →  http://localhost:8000
cd server
npm install
npm run db:migrate      # اعمال migrationها
npm run db:seed         # کاربران و پروژه‌ی نمونه
npm run dev

# 4) Frontend →  http://localhost:3000
cd client
npm install
npm run dev
```

### حساب‌های نمونه (فقط محیط توسعه)
| ایمیل | رمز | نقش در «Website Redesign» |
|---|---|---|
| `admin@example.com` | `Admin@12345` | OWNER |
| `sara@example.com` | `Sara@12345` | MEMBER |

### تست و کیفیت
```bash
cd server && npm run lint && npm run typecheck && npm test   # تست‌ها روی دیتابیس projectmanagement_test
cd client && npm run lint && npm run typecheck && npm run build
```

## مستندات

| سند | محتوا |
|---|---|
| [docs/00-AUDIT.md](docs/00-AUDIT.md) | بررسی کامل وضعیت فعلی، مشکلات و نقاط قوت |
| [docs/01-ROADMAP.md](docs/01-ROADMAP.md) | نقشه‌ی راه فازبندی‌شده (۰ تا ۶) با چک‌لیست و Definition of Done |
| [docs/02-API-CONTRACT.md](docs/02-API-CONTRACT.md) | قرارداد REST API بین client و server |
| [docs/03-IMPROVEMENTS.md](docs/03-IMPROVEMENTS.md) | پیشنهادهای توسعه و ارتقا |
| [server/docs/ARCHITECTURE.md](server/docs/ARCHITECTURE.md) · [CONVENTIONS.md](server/docs/CONVENTIONS.md) | معماری و قوانین Backend |
| [client/docs/ARCHITECTURE.md](client/docs/ARCHITECTURE.md) · [CONVENTIONS.md](client/docs/CONVENTIONS.md) | معماری و قوانین Frontend |

خلاصه‌ی قوانین الزامی هر بخش در `CLAUDE.md` همان پوشه است.
