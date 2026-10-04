import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 5 Definition of Done (docs/01-ROADMAP.md):
 * two browsers with two users — a change made in one (drag/create) shows up in
 * the other without a refresh, and the target user gets the in-app notification.
 * Uses the seeded "Website Redesign" project (admin = owner, sara = member).
 */

const ADMIN = { email: 'admin@example.com', password: 'Admin@12345' };
const SARA = { email: 'sara@example.com', password: 'Sara@12345' };
const API = 'http://localhost:8000';
const unique = () => `RT ${Date.now().toString(36)}`;

async function login(page: Page, user: typeof ADMIN) {
  await page.goto('/fa/login');
  await page.getByLabel('ایمیل').fill(user.email);
  await page.getByLabel('رمز عبور').fill(user.password);
  await page.getByRole('button', { name: 'ورود' }).click();
  // The app follows the profile locale (seeded sara is 'en') — pin both sessions to fa.
  await expect(page.getByRole('heading', { name: /داشبورد|Dashboard/ })).toBeVisible({ timeout: 15_000 });
  await page.request.patch(`${API}/users/me`, { data: { locale: 'fa' } });
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'fa', url: 'http://localhost:3002' }]);
  await page.goto('/fa');
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
}

async function openSeededProjectBoard(page: Page) {
  await page.goto('/fa/projects');
  await page.getByText('Website Redesign').first().click();
  await expect(page).toHaveURL(/\/projects\/\d+\/board$/, { timeout: 15_000 });
}

test('a task created by admin appears live on sara\u2019s board and in her bell', async ({ browser }) => {
  test.setTimeout(150_000);
  const title = unique();

  const adminContext = await browser.newContext();
  const saraContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const saraPage = await saraContext.newPage();

  await login(adminPage, ADMIN);
  await login(saraPage, SARA);

  await openSeededProjectBoard(adminPage);
  await openSeededProjectBoard(saraPage);

  // Admin creates a task; sara's board must pick it up over the socket, without reload.
  await adminPage.getByRole('button', { name: 'تسک جدید' }).click();
  const dialog = adminPage.getByRole('dialog');
  await dialog.getByLabel('عنوان').fill(title);
  await dialog.getByRole('button', { name: 'تسک جدید' }).click();
  await expect(dialog).toBeHidden();

  const saraBoard = saraPage.getByRole('region', { name: 'انجام نشده' });
  await expect(saraBoard.getByText(title)).toBeVisible({ timeout: 15_000 });

  // Assignment notification: admin assigns the task to sara from the sheet.
  await adminPage.getByText(title).first().click();
  const sheet = adminPage.getByRole('dialog');
  await sheet.getByLabel('مسئول').click();
  await adminPage.getByRole('option', { name: 'سارا احمدی' }).click();
  await adminPage.keyboard.press('Escape');

  // Sara's bell counts the new notification without any user interaction.
  await expect(saraPage.getByTestId('unread-badge')).toBeVisible({ timeout: 15_000 });

  await adminContext.close();
  await saraContext.close();
});
