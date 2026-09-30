import 'dotenv/config';

/** Integration tests run against `<database>_test` on the same server as DATABASE_URL. */
export function testDatabaseUrl(): string {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is not set');
  if (process.env.TEST_DATABASE_URL) return base;
  const url = new URL(base);
  const name = url.pathname.slice(1);
  url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`;
  return url.toString();
}
