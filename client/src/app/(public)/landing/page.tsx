import type { Metadata } from 'next';
import { LandingAnimations } from './landing-animations';
import './landing.css';

export const metadata: Metadata = {
  title: 'ManageSys — زمان‌بندی پروژه، از حدس تا محاسبه',
};

const FEATURES: { title: string; body: string; tone: string; wide?: boolean }[] = [
  {
    title: 'هوش مصنوعی سرپرست تیم',
    body: 'از یک عنوان خام، توضیح و زیرتسک با تخمین می‌سازد؛ تخمین را از تاریخچه‌ی واقعی تیم کالیبره می‌کند؛ استندآپ روزانه را از activity می‌نویسد؛ گفت‌وگوی طولانی را خلاصه می‌کند و داکیومنت کامل پروژه را تولید می‌کند. همه‌چیز پیش‌نمایش است: هیچ‌چیز بدون تأیید شما ثبت نمی‌شود.',
    tone: 'f-turquoise',
    wide: true,
  },
  {
    title: 'موتور زمان‌بندی CPM',
    body: 'Forward/backward pass روی گراف وابستگی‌ها؛ مسیر بحرانی و شناوری هر تسک محاسبه می‌شود. تقویم کاری پنجشنبه‌وجمعه و تعطیلات رسمی ایران را هم می‌شناسد.',
    tone: 'f-ink',
  },
  {
    title: 'پیش‌بینی مونت‌کارلو',
    body: '۲۰۰۰ بار شبیه‌سازی با توزیع مثلثی؛ به‌جای «سه‌شنبه تحویل می‌دهیم» می‌گوید «۸۵٪ شانس تحویل تا ۲۵ آبان».',
    tone: 'f-ink',
  },
  {
    title: 'امتیاز ریسک خودکار',
    body: 'هر تسک نمره‌ی ۰ تا ۱۰۰ می‌گیرد: تأخیر، شناوری منفی، رکود، اشباع مسئول. هر امتیاز دلیل دارد — کور نیست.',
    tone: 'f-gold',
  },
  {
    title: 'گزارش تحلیلی سه‌گانه',
    body: 'برن‌داون، فورکست و ریسک‌ها + هزینه‌ی زنده‌ی پروژه (ساعت × نرخ) در یک تب؛ خروجی CSV سازگار با اکسل فارسی.',
    tone: 'f-gold',
  },
  {
    title: 'ردیابی زمان و بودجه',
    body: 'کرنومتر داخل هر تسک، ثبت دستی برای تایمر فراموش‌شده، نرخ ساعتی فردی و نوار بودجه — پیش از overspend می‌فهمید، نه در فاکتور پایان دوره.',
    tone: 'f-ink',
  },
  {
    title: 'Heatmap بار تیم',
    body: 'نفر × هفته با رنگ سبز/کهربایی/قرمز نسبت به ظرفیت فردی؛ بیش‌بارها قبل از سوزاندن ددلاین دیده می‌شوند.',
    tone: 'f-ink',
  },
  {
    title: 'بورد کانبان کامل',
    body: 'درگ‌واندراپ با ترتیب کسری، زیرتسک، برچسب، WIP-limit با تأیید آگاهانه، اکشن گروهی و سطل زباله با بازگردانی.',
    tone: 'f-ink',
  },
  {
    title: 'Real-time و آفلاین',
    body: 'اعلان و همگام‌سازی زنده با Socket.IO؛ کل اپ یک PWA است — روی گوشی نصب می‌شود و بدون اینترنت هم باز می‌ماند.',
    tone: 'f-turquoise',
  },
];

const STACK: { group: string; items: string }[] = [
  { group: 'فرانت‌اند', items: 'Next.js 16 (App Router) · React 19 · TypeScript · TanStack Query 5 · Tailwind CSS 4 + shadcn/ui · Zustand · dnd-kit' },
  { group: 'بک‌اند', items: 'Express 5 · Prisma 7 · PostgreSQL · Zod (اعتبارسنجی دو طرف قرارداد)' },
  { group: 'زیرساخت زنده', items: 'Redis + BullMQ (یادآورها و کارهای زمان‌بندی‌شده) · Socket.IO (realtime) · PWA + Service Worker' },
  { group: 'کیفیت', items: 'Vitest (۱۶۹ تست) · MSW · Playwright E2E · ESLint + Prettier · OpenAPI/Swagger · Docker Compose · CI' },
  { group: 'امنیت', items: 'JWT با چرخش refresh و کشف استفاده‌ی مجدد · reset ضد enumeration · rate-limit · Helmet · origin-guard' },
  { group: 'فارسی‌سازی', items: 'next-intl (fa/en) · RTL کامل · تقویم و اعداد شمسی با date-fns-jalali · تعطیلات رسمی ایران در موتور زمان‌بندی' },
];

const FLOW = [
  { title: 'حساب بسازید یا از قالب شروع کنید', body: 'سه قالب آماده (انتشار نرم‌افزار، کمپین، رویداد) با ۱۲ تسک و وابستگی‌های از پیش چیده‌شده — صفحه‌ی سفید ندارید.' },
  { title: 'تسک‌ها را وارد کنید، AI کاملشان می‌کند', body: 'عنوان خام بنویسید؛ دکمه‌ی «تکمیل با هوش مصنوعی» توضیح، زیرتسک و تخمین پیشنهاد می‌دهد و مسئول مناسب را از روی skills اعضا پیدا می‌کند.' },
  { title: 'وابستگی‌ها را ببندید', body: '«پرداخت بعد از طراحی» — موتور CPM زنجیره را زمان‌بندی می‌کند، مسیر بحرانی را رنگ می‌زند و چرخه‌ها را همان لحظه رد می‌کند.' },
  { title: 'روزانه: تایمر و استندآپ', body: 'کرنومتر را روی تسک باز کنید؛ استندآپِ «دیروز/امروز/مانع» از activity واقعی شما ساخته می‌شود.' },
  { title: 'هفتگی: گزارش و ریسک', body: 'برن‌داون و امتیاز ریسک نشان می‌دهند چه چیزی الان می‌سوزد؛ heatmap می‌گوید بار را کجا جابه‌جا کنید.' },
  { title: 'تحویل با عدد', body: 'به‌جای «نزدیک است»، P85 را نشان می‌دهید: «۸۵٪ شانس تحویل تا ۲۵ آبان». جلسه‌ی «چرا دیر شد؟» برقرار نمی‌شود.' },
];

/** Public marketing/documentation page — /landing, outside the locale router and the PWA shell. */
export default function LandingPage() {
  return (
    <main className="landing-body">
      <LandingAnimations />

      {/* ---------- hero ---------- */}
      <header className="hero">
        <nav className="topbar" aria-label="ناوبری">
          <span className="topbar__brand">ManageSys</span>
          <div className="topbar__links">
            <a href="#features">فیچرها</a>
            <a href="#logic">منطق</a>
            <a href="#stack">تکنولوژی</a>
            <a href="#flow">روش استفاده</a>
          </div>
          <a className="btn btn--primary" href="/fa">
            ورود به سامانه
          </a>
        </nav>

        <div className="hero__grid container">
          <div className="hero__copy">
            <h1>
              زمان‌بندی پروژه،
              <br />
              از حدس تا محاسبه
            </h1>
            <p className="hero__lead">
              ManageSys یک سامانه‌ی مدیریت پروژه‌ی فارسی‌محور است: موتور زمان‌بندی CPM،
              پیش‌بینی مونت‌کارلو، دستیار هوش مصنوعی و ردیابی زمان — در یک PWA
              کاملاً آفلاین و راست‌به‌چپ.
            </p>
            <div className="hero__cta">
              <a className="btn btn--primary btn--lg" href="/fa">
                ورود به سامانه <span aria-hidden>←</span>
              </a>
              <a className="btn btn--ghost btn--lg" href="#logic">
                ببینید چطور فکر می‌کند
              </a>
            </div>
            <dl className="hero__stats">
              <div>
                <dt>شبیه‌سازی در هر فورکست</dt>
                <dd data-count="2000">۰</dd>
              </div>
              <div>
                <dt>تست خودکار سرور و کلاینت</dt>
                <dd data-count="169">۰</dd>
              </div>
              <div>
                <dt>دستیار هوش مصنوعی داخلی</dt>
                <dd data-count="6">۰</dd>
              </div>
            </dl>
          </div>

          {/* gantt mockup — the product's most characteristic view */}
          <figure className="gantt" role="img" aria-label="موکاپ تایم‌لاین پروژه با مسیر بحرانی و باند احتمال">
            <div className="gantt__chrome" aria-hidden>
              <i /><i /><i />
              <span>موبایل‌اپ کافه‌بازار — تایم‌لاین</span>
            </div>
            <div className="gantt__rows" aria-hidden>
              <div className="gantt__row">
                <span className="gantt__label">طراحی صفحه‌ی ورود</span>
                <span className="gantt__bar gantt__bar--critical" style={{ insetInlineStart: '4%', width: '26%' }} />
              </div>
              <div className="gantt__row">
                <span className="gantt__label">پیاده‌سازی API پرداخت</span>
                <span className="gantt__bar gantt__bar--critical g2" style={{ insetInlineStart: '30%', width: '34%' }} />
              </div>
              <div className="gantt__row">
                <span className="gantt__label">تست بتا با ۵۰ کاربر</span>
                <span className="gantt__bar g3" style={{ insetInlineStart: '56%', width: '22%' }} />
              </div>
              <div className="gantt__row">
                <span className="gantt__label">انتشار در کافه‌بازار</span>
                <span className="gantt__bar g4" style={{ insetInlineStart: '80%', width: '14%' }} />
              </div>
              <span className="gantt__band" />
              <span className="gantt__today" />
            </div>
            <figcaption className="gantt__chip" aria-hidden>
              P85: ۲۵ آبان · <b>۸۵٪</b> شانس تحویل
            </figcaption>
          </figure>
        </div>
      </header>

      {/* ---------- why ---------- */}
      <section className="section section--paper" id="why" data-reveal>
        <div className="container prose">
          <p className="kicker">چرا ساخته شد</p>
          <h2>سه دروغی که ابزارهای مدیریت پروژه به شما می‌گویند</h2>
          <ol className="lies">
            <li>
              <b>«تاریخ پایان قطعی است.»</b> CPM یک عدد می‌دهد؛ اما تخمین‌های انسانی
              همیشه خوش‌بینانه‌اند. ManageSys همان موتور CPM را ۲۰۰۰ بار با مدت‌های
              تصادفی اجرا می‌کند و توزیع احتمال می‌دهد.
            </li>
            <li>
              <b>«بار تیم نامرئی است.»</b> مجموع نقاط باز نمی‌گوید این هفته کی اشباع است.
              Heatmap نفر×هفته با ظرفیت فردی، بیش‌بار را قبل از سوزاندن ددلاین نشان می‌دهد.
            </li>
            <li>
              <b>«گزارش یعنی جمع‌زدن دستی.»</b> استندآپ، خلاصه‌ی هفتگی و داکیومنت پروژه از
              activity واقعی ساخته می‌شوند — نه از متن‌هایی که کسی بنشیند تایپ کند.
            </li>
          </ol>
          <div className="compare" aria-label="مقایسه تخمین و واقعیت">
            <div className="compare__row">
              <span>تخمین تیم</span>
              <span className="compare__bar compare__bar--est" style={{ width: '38%' }} />
              <b>۱۶ ساعت</b>
            </div>
            <div className="compare__row">
              <span>واقعیت (از تایمر)</span>
              <span className="compare__bar compare__bar--act" style={{ width: '62%' }} />
              <b>۲۳ ساعت</b>
            </div>
            <p>دقیقاً همین اختلاف، خوراک کالیبره‌شدن تخمین‌های بعدی است.</p>
          </div>
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section className="section" id="features" data-reveal>
        <div className="container">
          <p className="kicker">فیچرها</p>
          <h2>هر چیزی که یک تیم واقعاً هر روز لازم دارد</h2>
          <div className="bento">
            {FEATURES.map((f) => (
              <article key={f.title} className={`bento__card ${f.tone} ${f.wide ? 'bento__card--wide' : ''}`}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                {f.wide && (
                  <div className="ai-demo" aria-hidden>
                    <p className="ai-demo__q">برای «درگاه پرداخت» چه زیرتسک‌هایی لازم است؟</p>
                    <p className="ai-demo__typing"><i /><i /><i /></p>
                    <ul>
                      <li>پیاده‌سازی سرویس توکن‌سازی</li>
                      <li>اتصال به درگاه شاپرک</li>
                      <li>تست برگشت تراکنش ناموفق</li>
                    </ul>
                    <div className="ai-demo__foot">
                      <span className="chip">بر اساس ۳ تسک مشابه تیم</span>
                      <span className="chip chip--solid">ثبت زیرتسک‌ها ←</span>
                    </div>
                  </div>
                )}
                {!f.wide && f.title === 'Heatmap بار تیم' && (
                  <div className="heat" aria-hidden>
                    {Array.from({ length: 21 }, (_, i) => (
                      <i key={i} className={`heat__cell ${['h-low', 'h-mid', 'h-high'][i % 3]}`} style={{ animationDelay: `${i * 60}ms` }} />
                    ))}
                    <span className="heat__legend"><i className="h-low" /> آزاد <i className="h-mid" /> متوسط <i className="h-high" /> بیش‌بار</span>
                  </div>
                )}
                {!f.wide && f.title === 'بورد کانبان کامل' && (
                  <div className="mini-board" aria-hidden>
                    <div className="mini-board__col">
                      <span>در حال انجام · ۲</span>
                      <i className="card card--critical" />
                      <i className="card" />
                    </div>
                    <div className="mini-board__col">
                      <span>بازبینی · ۱</span>
                      <i className="card" />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- logic (documentation) ---------- */}
      <section className="section section--deep" id="logic" data-reveal>
        <div className="container prose prose--invert">
          <p className="kicker">منطق و الگوریتم</p>
          <h2>داخل موتور چه می‌گذرد؟</h2>

          <h3>۱. زمان‌بندی: Critical Path Method</h3>
          <p>
            هر تسک یک مدت (ساعت کاری) دارد و هر وابستگی یک یالِ «پایان‌به‌شروع».
            اول یک پیمایش رو به جلو earliest start/finish هر نود را می‌سازد، بعد رو به
            عقب latest start/finish؛ اختلافشان «شناوری» است. نودهای با شناوری صفر،
            مسیر بحرانی‌اند: اگر یک روز دیر شوند، پروژه یک روز دیر تمام می‌شود.
          </p>
          <div className="cpm" aria-hidden>
            <span className="cpm__node cpm__node--crit">طراحی<i>ES 0 · EF 16</i></span>
            <span className="cpm__edge" />
            <span className="cpm__node cpm__node--crit">API پرداخت<i>ES 16 · EF 40</i></span>
            <span className="cpm__edge" />
            <span className="cpm__node">تست بتا<i>ES 40 · EF 56 · شناوری ۸</i></span>
            <span className="cpm__edge" />
            <span className="cpm__node">انتشار<i>ES 56 · EF 64</i></span>
          </div>

          <h3>۲. پیش‌بینی: مونت‌کارلو روی همان گراف</h3>
          <p>
            مدت هر تسک به‌جای یک عدد، از توزیع مثلثی نمونه‌گیری می‌شود:
            خوش‌بینانه = ۰٫۷۵×، محتمل = ۱×، بدبینانه = ۱٫۵× تخمین.
            با هر نمونه، CPM دوباره اجرا می‌شود؛ توزیع تاریخ پایان، صدک‌های
            P50/P85/P95 را می‌دهد و «شانس تحویل تا ددلاین» از سهم اجراهای موفق حساب می‌شود.
          </p>
          <div className="hist" aria-hidden>
            {[18, 26, 42, 62, 80, 88, 78, 58, 38, 22, 12].map((h, i) => (
              <i key={i} className={`hist__bar ${i === 5 ? 'hist__bar--p85' : ''}`} style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
            ))}
            <span className="hist__mark hist__mark--p50">P50</span>
            <span className="hist__mark hist__mark--p85">P85</span>
            <span className="hist__mark hist__mark--p95">P95</span>
          </div>

          <h3>۳. اولویت: امتیاز ریسک توضیح‌پذیر</h3>
          <p>
            امتیاز هر تسک از جمع وزن‌دار سیگنال‌ها ساخته می‌شود و سقف ۱۰۰ دارد.
            وزن‌ها در env قابل تنظیم‌اند و هر امتیاز فهرست دلایل خودش را دارد:
          </p>
          <pre className="formula" aria-label="فرمول امتیاز ریسک">{`risk = clamp( 0 … 100,
  سررسید گذشته ۴۵ · نزدیک ۲۰ · بدون تاریخ ۸
  + بدون تخمین ۱۰ · مسیر بحرانی ۱۸
  + شناوری منفی تا ۱۸ · رکود تا ۱۲
  + اشباع مسئول ۱۵ · فوریت تا ۱۲ )`}</pre>

          <h3>۴. هوش مصنوعی: پیش‌نمایش، بعد ثبت</h3>
          <p>
            تمام خروجی مدل با Zod اعتبارسنجی می‌شود، پیشنهادِ عضوِ غیرعضو حذف می‌شود و
            سرور هیچ‌چیز نمی‌نویسد — کاربر می‌بیند، انتخاب می‌کند، بعد endpointهای عادی
            ثبت می‌کنند. سازگار با هر provider سازگار OpenAI؛ پیش‌فرض مدل‌های رایگان.
          </p>
        </div>
      </section>

      {/* ---------- stack ---------- */}
      <section className="section section--paper" id="stack" data-reveal>
        <div className="container">
          <p className="kicker">تکنولوژی</p>
          <h2>انتخاب‌ها و این‌که چرا</h2>
          <dl className="stack">
            {STACK.map((s) => (
              <div key={s.group} className="stack__row">
                <dt>{s.group}</dt>
                <dd>{s.items}</dd>
              </div>
            ))}
          </dl>
          <p className="stack__note">
            قرارداد API یک منبع حقیقت مشترک است: سند OpenAPI زنده، اعتبارسنجی Zod دو سرِ
            خط، و برای هر endpoint جدید، handler در تست‌های MSW کلاینت.
          </p>
        </div>
      </section>

      {/* ---------- flow ---------- */}
      <section className="section" id="flow" data-reveal>
        <div className="container">
          <p className="kicker">روش استفاده</p>
          <h2>از ثبت‌نام تا تحویل با عدد</h2>
          <ol className="flow">
            {FLOW.map((step, i) => (
              <li key={step.title} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="flow__num">{`۱۲۳۴۵۶`[i]}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- final cta ---------- */}
      <footer className="outro">
        <div className="container" data-reveal>
          <h2>پروژه‌ی بعدی را با عدد مدیریت کنید</h2>
          <div className="hero__cta hero__cta--center">
            <a className="btn btn--primary btn--lg" href="/fa">
              ورود به سامانه <span aria-hidden>←</span>
            </a>
            <a className="btn btn--ghost btn--lg btn--ghost-dark" href="#logic">
              دوباره‌ی مستندات
            </a>
          </div>
          <p className="outro__fine">
            حساب نمونه: admin@example.com / Admin@12345 — کد منبع در دسترس تیم توسعه است.
          </p>
        </div>
      </footer>
    </main>
  );
}
