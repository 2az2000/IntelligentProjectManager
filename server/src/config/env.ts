import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .preprocess(
      // Some dev environments export a global PORT=0 ("auto"); treat it and empty strings as unset.
      (value) => (value === undefined || value === '' || value === '0' ? undefined : value),
      z.coerce.number().int().positive().default(8000),
    )
    .pipe(z.number().int().positive()),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // Phase 4: working-day calendar for scheduling (weekend days; Thu/Fri = Iran default).
  WORKING_WEEKEND: z.string().default('THURSDAY,FRIDAY'),
  // §2.10: calendar-day boundaries and the digest/reminder cron run in this zone. The images
  // are UTC, so without it "today" starts at 03:30 Tehran and 08:00 fires at 11:30.
  APP_TIME_ZONE: z
    .string()
    .default('Asia/Tehran')
    .refine(
      (timeZone) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone });
          return true;
        } catch {
          return false;
        }
      },
      { message: 'must be a valid IANA time zone, e.g. Asia/Tehran' },
    ),
  // Phase 4: disk-local attachment storage.
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  // Phase 6: global per-IP request budget (the auth endpoints have their own tighter limiter).
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  // Phase 5: realtime + background jobs.
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // §Imp #4 workload heatmap: weekly hours one full-time person is presumed to absorb.
  // Global for now; per-member overrides come with capacityHoursPerWeek later.
  WEEKLY_CAPACITY: z.coerce.number().int().positive().default(40),
  // Phase 7: free-tier LLM through any OpenAI-compatible endpoint (OpenRouter by default:
  // Groq is blocked for Iranian IPs). Without AI_API_KEY the /ai endpoints answer
  // 503 AI_NOT_CONFIGURED.
  //
  // Keep the default a model that *exists right now*: a retired slug answers 404 and reads as
  // "the AI service is unavailable". OpenRouter's catalog churns, so verify before changing it:
  // `curl -s https://openrouter.ai/api/v1/models/<model>/endpoints | head -c 400` should list at
  // least one endpoint with `response_format` in supported_parameters.
  AI_API_KEY: z.string().min(1).optional(),
  AI_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  AI_MODEL: z.string().default('nvidia/nemotron-3-super-120b-a12b:free'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // Phase 7 resilience: a rate-limited or 5xx provider shouldn't surface as a dead feature.
  // AI_RETRY_ATTEMPTS× backoff runs first, then the request walks AI_FALLBACK_MODELS on the
  // same provider and finally AI_FALLBACK_* (a second provider, e.g. Google AI Studio) once
  // its key is set. Note that OpenRouter's free-model daily cap (50/day under 10 credits of
  // lifetime purchases) is account-wide: another `:free` slug does NOT reset it, so a second
  // provider — not another free model — is what escapes a capped day.
  AI_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(2),
  AI_RETRY_BASE_MS: z.coerce.number().int().min(0).max(10_000).default(800),
  // A *chain*, not one spare: OpenRouter routes each `:free` slug through a shared upstream pool,
  // so a single busy model answers 429 for minutes while its neighbours are idle. Each entry is
  // tried in order and a slug that has been retired (404) is simply skipped, which is why a few
  // names here outlive any one of them. Set your own list to override (empty = no fallbacks).
  AI_FALLBACK_MODELS: z
    .string()
    .default(
      'google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-super-120b-a12b:free,dots-studio/dots-3-note-preview:free,apodex/apodex-1.1-mini:free,liquid/lfm-2.5-2.6b:free',
    )
    .transform((value) =>
      value
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  AI_FALLBACK_API_KEY: z.string().min(1).optional(),
  AI_FALLBACK_BASE_URL: z.url().optional(),
  AI_FALLBACK_MODEL: z.string().optional(),
  // §AI semantic search: embeddings share the AI provider by default (OpenRouter exposes
  // POST /embeddings). The column is vector(1536), so models must answer 1536 floats;
  // text-embedding-3-small is the default for exactly that reason. Without a usable key the
  // search endpoint stays lexical and says so (`semantic.available: false`).
  AI_EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
  AI_EMBEDDING_API_KEY: z.string().min(1).optional(),
  AI_EMBEDDING_BASE_URL: z.url().optional(),
  // §2.1: real email delivery. Without SMTP_URL the mailer stays in "json" mode (logs the
  // message) so development and tests never need a mail server. MAIL_ENABLED=false turns
  // delivery off entirely. MAIL_FROM is the RFC 5322 From header.
  SMTP_URL: z.string().min(1).optional(),
  MAIL_FROM: z.string().default('ManageSys <noreply@managesys.local>'),
  MAIL_ENABLED: z
    .preprocess((value) => (value === undefined || value === '' ? undefined : value === 'true' || value === '1'), z.boolean().default(true)),
  JOBS_ENABLED: z
    .preprocess((value) => (value === undefined || value === '' ? undefined : value === 'true' || value === '1'), z.boolean().default(true)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Logger depends on env, so this is the one place we write to stderr directly.
  process.stderr.write(
    `Invalid environment variables:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}\n`,
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
