import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 4 Definition of Done (docs/01-ROADMAP.md) — Timeline/Gantt:
 * estimates + a finish-to-start dependency must produce a CPM schedule with
 * duration, critical path and bars on the timeline view.
 * Runs against the real dev servers and the seeded development database.
 */

const ADMIN = { email: 'admin@example.com', password: 'Admin@12345' };
const unique = () => `E2E ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function login(page: Page) {
  await page.goto('/fa/login');
  await page.getByLabel('ایمیل').fill(ADMIN.email);
  await page.getByLabel('رمز عبور').fill(ADMIN.password);
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
}

test('timeline renders the CPM schedule from estimates and dependencies', async ({ page }) => {
  test.setTimeout(150_000);
  const projectName = unique();
  const taskA = `A ${unique()}`; // successor, 8 h
  const taskB = `B ${unique()}`; // predecessor, 24 h

  await login(page);

  // ---- create the project (lands on its board) -------------------------------------------
  await page.getByRole('button', { name: 'پروژه جدید' }).first().click();
  const projectDialog = page.getByRole('dialog');
  await projectDialog.getByLabel('نام پروژه').fill(projectName);
  await projectDialog.getByRole('button', { name: 'ایجاد پروژه' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/\\d+/board$`), { timeout: 15_000 });

  // ---- create two estimated tasks ---------------------------------------------------------
  const createTask = async (title: string, estimate: string) => {
    await page.getByRole('button', { name: 'تسک جدید' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('عنوان').fill(title);
    await dialog.getByLabel('تخمین (ساعت)').fill(estimate);
    await dialog.getByRole('button', { name: 'تسک جدید' }).click();
    await expect(dialog).toBeHidden();
  };
  await createTask(taskA, '8');
  await createTask(taskB, '24');

  // ---- link A → depends on B through the task sheet ---------------------------------------
  await page.getByText(taskA).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('وابستگی‌ها')).toBeVisible();
  await sheet.getByLabel('وابسته به').click();
  await page.getByRole('option', { name: taskB }).click();
  await expect(sheet.getByText(taskB, { exact: false }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // ---- the timeline view must show the chained schedule ------------------------------------
  await page
    .getByRole('navigation', { name: 'نماهای پروژه' })
    .getByRole('link', { name: 'زمان‌بندی' })
    .click();

  // 24 h (B) + 8 h (A) chained on the critical path.
  await expect(page.getByText('مجموعاً ۳۲ ساعت')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('۲ تسک در مسیر بحرانی')).toBeVisible();

  // Both estimated tasks have bars; the unestimated warning stays away.
  await expect(page.getByRole('img', { name: new RegExp(taskB) })).toBeVisible();
  await expect(page.getByRole('img', { name: new RegExp(taskA) })).toBeVisible();
  await expect(page.getByText('تخمین ساعت ندارند')).toHaveCount(0);
});

test('timeline shows the empty state for a project without tasks', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await page.getByRole('button', { name: 'پروژه جدید' }).first().click();
  const projectDialog = page.getByRole('dialog');
  const emptyProject = unique();
  await projectDialog.getByLabel('نام پروژه').fill(emptyProject);
  await projectDialog.getByRole('button', { name: 'ایجاد پروژه' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/\\d+/board$`), { timeout: 15_000 });

  await page
    .getByRole('navigation', { name: 'نماهای پروژه' })
    .getByRole('link', { name: 'زمان‌بندی' })
    .click();

  await expect(page.getByText('هنوز تسکی برای زمان‌بندی نیست')).toBeVisible({ timeout: 15_000 });
});
