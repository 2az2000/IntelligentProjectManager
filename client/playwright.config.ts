import { defineConfig, devices } from '@playwright/test';

// Some dev shells export PORT=0 globally; treat that as unset and fall back to 3002.
const rawPort = process.env.PORT && process.env.PORT !== '0' ? process.env.PORT : undefined;
const PORT = Number(rawPort ?? 3002);
const API_PORT = Number(process.env.API_PORT || 8000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // The CI job runs against `next dev`, so the first hit on a route pays its compile cost.
  timeout: process.env.CI ? 60_000 : 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // In local dev the servers are usually already running (started outside Playwright);
  // the webServer entries only boot them when nothing is listening.
  webServer: process.env.CI
    ? [
        {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: false,
          // Cold Next.js start plus the first compile of `/` takes ~1 min on a runner.
          timeout: 180_000,
          env: { PORT: String(PORT) },
        },
        {
          command: 'npm run dev',
          cwd: '../server',
          url: `http://localhost:${API_PORT}/health`,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ]
    : [],
});
