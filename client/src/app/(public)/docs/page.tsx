import type { Metadata } from 'next';
import Link from 'next/link';
import './docs.css';

export const metadata: Metadata = {
  title: 'داکیومنت ManageSys',
};

const TOC = [
  { id: 'overview', label: 'نمای کلی سامانه' },
  { id: 'structure', label: 'معماری و لایه‌ها' },
  { id: 'engine', label: 'موتور زمان‌بندی' },
  { id: 'ai', label: 'دستیار هوش مصنوعی' },
  { id: 'api', label: 'قرارداد API' },
  { id: 'faq', label: 'سؤال‌های پرتکرار' },
  { id: 'local', label: 'اجرای محلی' },
  { id: 'accounts', label: 'حساب‌های نمونه' },
  { id: 'summary', label: 'جمع‌بندی' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'ManageSys دقیقاً چه فرقی با ابزارهای معمول مدیریت پروژه دارد؟',
    a: 'زمان‌بندی اینجا عدد است، نه حدس: موتور CPM مسیر بحرانی را حساب می‌کند، مونت‌کارلو ۲۰۰۰ بار شبیه‌سازی می‌کند و به‌جای «تا سه‌شنبه» می‌گوید «۸۵٪ شانس تحویل تا ددلاین». هر تسک هم امتیاز ریسک توضیح‌پذیر دارد.',
  },
  {
    q: 'دستیار هوش مصنوعی داده‌ها را کجا نگه می‌دارد یا کِی می‌نویسد؟',
    a: 'هیچ‌وقت مستقیم نمی‌نویسد. هر خروجی AI فقط پیش‌نمایش است و تا تأیید کاربر روی هیچ جدولی اثری ندارد. این بخش به /fa/app، سمت Session شما سرعتش را می‌گیرد تخمین‌های پایه‌ای داردذا را。',
  },
  {
    q: 'چطور بین فارسی و انگلیسی جابه‌جا شوم؟',
    a: 'اپ روی /fa/app و /en/app سرو می‌شود و برای هر زبان URL مستقل دارد؛ سوییچر زبان در ناوبار اپ همان مسیر را با زبان دیگر باز می‌کند. صفحات عمومی (landing و داکیومنت) فارسی واحد‌اند.',
  },
  {
    q: 'آفلاین هم کار می‌کند؟',
    a: 'بله. کل اپ یک PWA است: با install روی گوشی/دسکتاپ نصب می‌شود و Service Worker استاتیک‌ها را کش می‌کند؛ بدون اینترنت هم باز می‌ماند و داده‌ها بعد از برقراری اتصال سینک می‌شوند.',
  },
  {
    q: 'امنیت آن چطور است؟',
    a: 'JWT با چرخش refresh و کشف استفاده‌ی مجدد، reset ضد enumeration، rate-limit، Helmet و origin-guard — همگی در سرور اعمال شده‌اند.',
  },
];

/** Standalone documentation page — /docs, blog-style layout like lastaar.com articles. */
export default function DocsPage() {
  return (
    <>
      <header className="docs-topbar">
        <div className="docs-topbar__inner">
          <Link href="/landing" className="docs-topbar__brand">
            ManageSys
          </Link>
          <span className="docs-topbar__crumb" aria-hidden>/</span>
          <span className="docs-topbar__page">داکیومنت</span>
          <Link className="docs-topbar__cta" href="/fa/app">ورود به سامانه</Link>
        </div>
      </header>

      <div className="docs-layout">
        {/* ---------- article ---------- */}
        <article className="docs-article">
          <div className="docs-crumb">
            <Link href="/landing">خانه</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">داکیومنت</span>
          </div>

          <header className="docs-header">
            <div className="docs-tags">
              <span className="docs-tag">سند فنی</span>
              <span className="docs-tag docs-tag--soft">ManageSys</span>
            </div>
            <h1>مستندات سامانه‌ی هوشمند مدیریت پروژه</h1>
            <p className="docs-lead">
              معمارى، منطق موتور زمان‌بندی، دستیار هوش مصنوعی، قرارداد API و راه‌اندازی
              محلی — همه در یک صفحه‌ی مرجع. صفحه‌ی معرفی محصول در{' '}
              <Link href="/landing">landing</Link> است؛ اینجا فقط داکیومنت فنی.
            </p>
            <dl className="docs-meta">
              <div>
                <dt>بازخوانی</dt>
                <dd>~۷ دقیقه</dd>
              </div>
              <div>
                <dt>همراه با</dt>
                <dd>قرارداد API زنده در /api/docs</dd>
              </div>
            </dl>
          </header>

          {/* ---------- overview ---------- */}
          <section className="docs-section" id="overview">
            <h2>نمای کلی سامانه</h2>
            <p>
              ManageSys یک monorepo دو بخشی است: <code>client/</code> (Next.js 16 + React 19
              + TypeScript) و <code>server/</code> (Express 5 + Prisma 7 + PostgreSQL).
              اپ اصلی دوزبانه است (فارسی/انگلیسی با next-intl) و روی مسیر <code>/fa/app</code> یا{' '}
              <code>/en/app</code> سرو می‌شود؛ صفحات عمومی (landing و همین داکیومنت) از
              سیستم locale مستقل‌اند.
            </p>
            <ul>
              <li>احراز هویت JWT با چرخش refresh و کشف استفاده‌ی مجدد</li>
              <li>Realtime با Socket.IO برای اعلان و هم‌گاه‌سازی بورد</li>
              <li>Redis + BullMQ برای یادآورها و کارهای زمان‌بندی‌شده</li>
              <li>PWA کامل: نصب روی موبایل و کارکرد آفلاین</li>
            </ul>
          </section>

          {/* ---------- structure ---------- */}
          <section className="docs-section" id="structure">
            <h2>معماری و لایه‌ها</h2>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <caption>لایه‌های اصلی و مسئولیت هر کدام</caption>
                <thead>
                  <tr>
                    <th>لایه</th>
                    <th>تکنولوژی</th>
                    <th>مسئولیت</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>رابط کاربری</td><td>Next.js 16، React 19، Tailwind 4، shadcn/ui</td><td>اپ دوزبانه، RTL کامل، بورد کانبان، تایم‌لاین</td></tr>
                  <tr><td>State</td><td>TanStack Query 5 + Zustand</td><td>کش سرور، optimistic updates</td></tr>
                  <tr><td>API</td><td>Express 5 + Zod</td><td>اعتبارسنجی دو سرِ قرارداد، OpenAPI زنده</td></tr>
                  <tr><td>داده</td><td>Prisma 7 + PostgreSQL</td><td>مدل‌ها، Migration و seed</td></tr>
                  <tr><td>زیرساخت زنده</td><td>Redis، BullMQ، Socket.IO</td><td>Jobها، یادآورها، رویدادهای real-time</td></tr>
                  <tr><td>کیفیت</td><td>Vitest، MSW، Playwright</td><td>۱۶۹+ تست خودکار سرور و کلاینت</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------- engine ---------- */}
          <section className="docs-section" id="engine">
            <h2>موتور زمان‌بندی (CPM + مونت‌کارلو)</h2>
            <h3>مسیر بحرانی</h3>
            <p>
              موتور روی گراف وابستگی‌های تسک‌ها forward/backward pass اجرا می‌کند:
              earliest/latest start و finish هر نود و شناوری (float) هر تسک محاسبه
              می‌شود. تسک‌های با شناوری صفر مسیر بحرانی‌اند؛ اگر یک روز دیر شوند،
              پروژه یک روز دیر تمام می‌شود. تقویم کاری پنج‌شنبه‌وجمعه و تعطیلات
              رسمی ایران در محاسبه‌ی روزها لحاظ می‌شود.
            </p>
            <div className="docs-card docs-card--note">
              <h4>پیش‌بینی احتمالاتی</h4>
              <p>
                مدت هر تسک به‌جای یک عدد، از توزیع مثلثی نمونه‌گیری می‌شود
                (خوش‌بینانه ۰٫۷۵×، محتمل ۱×، بدبینانه ۱٫۵× تخمین). با هر نمونه CPM دوباره
                اجرا می‌شود؛ خروجی، توزیع تاریخ پایان و صدک‌های P50/P85/P95 و احتمال
                تحویل تا دیلاین است.
              </p>
            </div>
            <div className="docs-card docs-card--warn">
              <h4>امتیاز ریسک توضیح‌پذیر</h4>
              <p>
                هر تسک نمره‌ی ۰ تا ۱۰۰ می‌گیرد: سررسید گذشته/نزدیک، بدون تخمین، مسیر
                بحرانی، شناوری منفی، رکود، اشباع مسئول و فوریت. هر امتیاز فهرست دلایل
                خودش را دارد و وزن‌ها در env قابل تنظیم‌اند.
              </p>
            </div>
          </section>

          {/* ---------- ai ---------- */}
          <section className="docs-section" id="ai">
            <h2>دستیار هوش مصنوعی</h2>
            <p>
              همه‌ی خروجی مدل فقط <strong>پیش‌نمایش</strong> است و با Zod اعتبارسنجی
              می‌شود؛ سرور هیچ‌چیز بدون تأیید کاربر نمی‌نویسد. قابلیت‌ها:
            </p>
            <ul>
              <li>تکمیل تسک از عنوان خام: توضیح، زیرتسک و تخمین کالیبره‌شده از تاریخچه‌ی تیم</li>
              <li>استندآپ روزانه: خلاصه‌ی «دیروز/امروز/مانع» از activity واقعی</li>
              <li>خلاصه‌ی گفت‌وگوی طولانی thread و پیشنهاد برچسب</li>
            </ul>
          </section>

          {/* ---------- api ---------- */}
          <section className="docs-section" id="api">
            <h2>قرارداد API</h2>
            <p>
              سند OpenAPI زنده در <code>/api/docs</code> منبع حقیقت مشترک است و
              اعتبارسنجی Zod دو سرِ خط را پوشش می‌دهد. چند endpoint پرکاربرد:
            </p>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr><th>متد</th><th>مسیر</th><th>کاربرد</th></tr>
                </thead>
                <tbody>
                  <tr><td><span className="m-post">POST</span></td><td><code>/api/auth/login</code></td><td>ورود و دریافت JWT</td></tr>
                  <tr><td><span className="m-get">GET</span></td><td><code>/api/auth/me</code></td><td>کاربر جاری (با refresh خودکار)</td></tr>
                  <tr><td><span className="m-get">GET</span></td><td><code>/api/projects</code></td><td>فهرست پروژه‌های کاربر</td></tr>
                  <tr><td><span className="m-post">POST</span></td><td><code>/api/tasks</code></td><td>ایجاد تسک</td></tr>
                  <tr><td><span className="m-get">GET</span></td><td><code>/api/projects/:id/schedule</code></td><td>زمان‌بندی CPM + مونت‌کارلو</td></tr>
                </tbody>
              </table>
            </div>
            <div className="docs-card docs-card--note">
              <h4>قاعده‌ی تغییر API</h4>
              <p>
                هر تغییر مشترک اول در سند قرارداد (API-CONTRACT) ثبت می‌شود، بعد سمت
                server با تست، بعد client — هرگز برعکس.
              </p>
            </div>
          </section>

          {/* ---------- faq ---------- */}
          <section className="docs-section" id="faq">
            <h2>سؤال‌های پرتکرار</h2>
            {FAQS.map((f, i) => (
              <details key={f.q} className="docs-faq" open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>

          {/* ---------- local ---------- */}
          <section className="docs-section" id="local">
            <h2>اجرای محلی</h2>
            <pre className="docs-code" dir="ltr">{`# 1. Database + Redis
docker compose up -d          # Postgres on :5433

# 2. Server
cd server && npm install && npm run db:seed && npm run dev   # :8000

# 3. Client
cd client && npm install && npm run dev                      # :3000`}</pre>
          </section>

          {/* ---------- accounts ---------- */}
          <section className="docs-section" id="accounts">
            <h2>حساب‌های نمونه</h2>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <caption>پس از اجرای db:seed در دسترس‌اند</caption>
                <thead>
                  <tr><th>نقش</th><th>ایمیل</th><th>رمز</th></tr>
                </thead>
                <tbody>
                  <tr><td>مدیر</td><td><code dir="ltr">admin@example.com</code></td><td><code dir="ltr">Admin@12345</code></td></tr>
                  <tr><td>عضو تیم</td><td><code dir="ltr">sara@example.com</code></td><td><code dir="ltr">Sara@12345</code></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------- summary ---------- */}
          <section className="docs-summary" id="summary">
            <h2>جمع‌بندی</h2>
            <p>
              ManageSys زمان‌بندی را از حدس به محاسبه می‌برد: CPM و مونت‌کارلو به
              جای «تقریب»، P85 می‌دهند؛ دستیار AI پیش‌نمایش می‌سازد و با تأیید شما
              ثبت می‌کند؛ و کل اپ دو‌زبانه، RTL و آفلاین است. برای شروع،
              <Link href="/fa/app">ورود به سامانه</Link> یا اجرای محلی طبق بخش بالا.
            </p>
            <div className="docs-summary-actions">
              <Link className="docs-btn docs-btn--primary" href="/fa/app">ورود به سامانه</Link>
              <Link className="docs-btn docs-btn--ghost" href="/landing">معرفی محصول</Link>
            </div>
          </section>
        </article>

        {/* ---------- sticky TOC ---------- */}
        <aside className="docs-toc" aria-label="فهرست مطالب">
          <p className="docs-toc__title">فهرست مطالب</p>
          <nav>
            <ol>
              {TOC.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.label}</a>
                </li>
              ))}
            </ol>
          </nav>
          <Link className="docs-toc__cta" href="/fa/app">ورود به سامانه ←</Link>
        </aside>
      </div>

      <footer className="docs-footer">
        <p>
          ManageSys — کد منبع در دسترس تیم توسعه است · صفحه‌های عمومی:{' '}
          <Link href="/landing">معرفی محصول</Link> · <Link href="/fa/app">ورود به سامانه</Link>
        </p>
      </footer>
    </>
  );
}
