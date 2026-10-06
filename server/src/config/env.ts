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
  // Phase 4: disk-local attachment storage.
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  // Phase 6: global per-IP request budget (the auth endpoints have their own tighter limiter).
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  // Phase 5: realtime + background jobs.
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // Phase 7: free-tier LLM through any OpenAI-compatible endpoint (Groq by default).
  // Without AI_API_KEY the /ai endpoints answer 503 AI_NOT_CONFIGURED and everything else works.
  AI_API_KEY: z.string().min(1).optional(),
  AI_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
  AI_MODEL: z.string().default('llama-3.3-70b-versatile'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
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
