import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 3 Definition of Done (docs/01-ROADMAP.md):
 * login → create project → invite member → create task → drag → comment.
 * Runs against the real dev servers and the seeded development database.
 */

const ADMIN = { email: 'admin@example.com', password: 'Admin@12345' };
const unique = () => `E2E ${Date.now().toString(36)}`;

async function login(page: Page) {
  await page.goto('/fa/login');
  await page.getByLabel('ایمیل').fill(ADMIN.email);
  await page.getByLabel('رمز عبور').fill(ADMIN.password);
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
}

test('full collaboration flow: login → project → member → task → drag → comment', async ({ page }) => {
  test.setTimeout(120_000);
  const projectName = unique();
  const taskTitle = `تسک ${unique()}`;
  const commentText = 'کامنت تستی E2E';

  // ---- login ---------------------------------------------------------------------------
  await login(page);

  // ---- create project ------------------------------------------------------------------
  await page.getByRole('button', { name: 'پروژه جدید' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('نام پروژه').fill(projectName);
  await dialog.getByRole('button', { name: 'ایجاد پروژه' }).click();
  // Success ⇒ dialog closes and the app navigates straight to the new project's board.
  await expect(page).toHaveURL(new RegExp(`/projects/\\d+/board$`), { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'نماهای پروژه' })).toBeVisible();

  // ---- invite member (search sara, add as MEMBER) ---------------------------------------
  await page.getByRole('navigation', { name: 'نماهای پروژه' }).getByRole('link', { name: 'تنظیمات' }).click();
  await page.getByLabel('جستجوی کاربر با نام یا ایمیل...').fill('sara');
  await page.getByRole('button', { name: 'افزودن' }).click();
  // Stable assertion: the new member appears in the list (the toast may expire quickly).
  const membersList = page.locator('ul').filter({ hasText: 'sara@example.com' });
  await expect(membersList).toBeVisible();
  // exact: the success toast («سارا احمدی به پروژه اضافه شد») also contains the name.
  await expect(page.getByText('سارا احمدی', { exact: true })).toBeVisible();

  // ---- create a task on the board --------------------------------------------------------
  await page.getByRole('navigation', { name: 'نماهای پروژه' }).getByRole('link', { name: 'بورد' }).click();
  await page.getByRole('button', { name: 'تسک جدید' }).click();
  const taskDialog = page.getByRole('dialog');
  await taskDialog.getByLabel('عنوان').fill(taskTitle);
  await taskDialog.getByRole('button', { name: 'تسک جدید' }).click();
  await expect(taskDialog).toBeHidden();

  const todoColumn = page.getByRole('region', { name: 'انجام نشده' });
  const card = todoColumn.getByText(taskTitle);
  await expect(card).toBeVisible();

  // ---- drag the card from "To Do" to "Review" --------------------------------------------
  // dnd-kit needs a real pointer path with movement (not native HTML5 drag), so do it manually.
  const reviewColumn = page.getByRole('region', { name: 'بازبینی' });
  await card.hover();
  await page.mouse.down();
  await page.mouse.move(20, 20, { steps: 2 }); // pass the 6px activation threshold
  await reviewColumn.hover();
  await page.mouse.up();
  await expect(reviewColumn.getByText(taskTitle)).toBeVisible({ timeout: 10_000 });

  // Reload ⇒ ordering/status must persist (DoD: ترتیب کارت‌ها بعد از refresh حفظ می‌شود)
  await page.reload();
  await expect(page.getByRole('region', { name: 'بازبینی' }).getByText(taskTitle)).toBeVisible();

  // ---- open task sheet and write a comment ------------------------------------------------
  await page.getByRole('region', { name: 'بازبینی' }).getByText(taskTitle).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByPlaceholder('نظر خود را بنویسید...').fill(commentText);
  await sheet.getByRole('button', { name: 'ارسال' }).click();
  await expect(sheet.getByText(commentText)).toBeVisible();
});

test('invalid login shows the translated Persian error', async ({ page }) => {
  await page.goto('/fa/login');
  await page.getByLabel('ایمیل').fill(ADMIN.email);
  await page.getByLabel('رمز عبور').fill('wrong-password');
  await page.getByRole('button', { name: 'ورود' }).click();

  await expect(page.getByText('ایمیل یا رمز عبور اشتباه است.')).toBeVisible();
});

test('protected page redirects to login and comes back via ?next=', async ({ page }) => {
  await page.goto('/fa/projects');
  await expect(page).toHaveURL(/\/fa\/login\?next=%2Fprojects/);

  await page.getByLabel('ایمیل').fill(ADMIN.email);
  await page.getByLabel('رمز عبور').fill(ADMIN.password);
  await page.getByRole('button', { name: 'ورود' }).click();

  await expect(page).toHaveURL(/\/fa\/projects$/);
  await expect(page.getByRole('heading', { name: 'پروژه‌ها' })).toBeVisible();
});
