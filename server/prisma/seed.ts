/**
 * Development seed — idempotent. Demo accounts (development only!):
 *   admin@example.com / Admin@12345   owner of both sample projects
 *   sara@example.com  / Sara@12345    member
 *   reza@example.com  / Reza@12345    member (Mobile App) / viewer (Website)
 */
import type { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma } from '../src/shared/db/prisma';
import { hashPassword } from '../src/modules/auth';

const LEGACY_ADMIN_EMAIL = 'admin@example.local'; // created by the auth migration from the old "admin" user
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

async function upsertUser(email: string, name: string, password: string, legacyEmail?: string) {
  const passwordHash = await hashPassword(password);
  const existing =
    (await prisma.user.findUnique({ where: { email } })) ??
    (legacyEmail ? await prisma.user.findUnique({ where: { email: legacyEmail } }) : null);
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: { email, name, passwordHash } });
  }
  return prisma.user.create({ data: { email, name, passwordHash } });
}

async function ensureMember(projectId: number, userId: number, role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId, role },
  });
}

interface SeedTask {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  points?: number;
  assigneeId?: number;
  dueInDays?: number;
  estimateHours?: number;
  tags?: string[];
  description?: string;
  subtasks?: { title: string; done?: boolean }[];
  comments?: { authorId: number; body: string }[];
}

async function createTasks(
  projectId: number,
  authorId: number,
  tasks: SeedTask[],
): Promise<{ id: number; title: string }[]> {
  const created: { id: number; title: string }[] = [];
  const positions = new Map<TaskStatus, number>();
  for (const t of tasks) {
    const position = (positions.get(t.status) ?? 0) + 1024;
    positions.set(t.status, position);
    const data: Prisma.TaskUncheckedCreateInput = {
      projectId,
      authorId,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      points: t.points ?? null,
      assigneeId: t.assigneeId ?? null,
      estimateHours: t.estimateHours ?? null,
      dueDate: t.dueInDays !== undefined ? daysFromNow(t.dueInDays) : null,
      completedAt: t.status === 'DONE' ? daysFromNow(-2) : null,
      tags: t.tags ?? [],
      position,
    };
    const task = await prisma.task.create({ data });
    created.push({ id: task.id, title: task.title });
    for (const [i, sub] of (t.subtasks ?? []).entries()) {
      await prisma.task.create({
        data: {
          projectId,
          authorId,
          parentId: task.id,
          title: sub.title,
          status: sub.done ? 'DONE' : 'TODO',
          completedAt: sub.done ? daysFromNow(-1) : null,
          position: (i + 1) * 1024,
        },
      });
    }
    for (const c of t.comments ?? []) {
      await prisma.comment.create({ data: { taskId: task.id, authorId: c.authorId, body: c.body } });
    }
  }
  return created;
}

/** Links finish-to-start dependencies by seed-task title (throws when a title is missing). */
async function linkDependencies(
  tasks: { id: number; title: string }[],
  pairs: [string, string][],
) {
  const idOf = (title: string) => {
    const t = tasks.find((x) => x.title === title);
    if (!t) throw new Error(`Seed task not found: ${title}`);
    return t.id;
  };
  await prisma.taskDependency.createMany({
    data: pairs.map(([from, to]) => ({ predecessorId: idOf(from), successorId: idOf(to) })),
    skipDuplicates: true,
  });
}

/**
 * Top-up for databases seeded before phase 4: applies estimates and dependencies
 * to the demo tasks whether they were just created or already existed.
 * Keep the estimates in sync with the SeedTask lists above.
 */
async function ensureSchedule(
  projectId: number,
  estimates: Record<string, number>,
  pairs: [string, string][],
) {
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null, parentId: null, title: { in: Object.keys(estimates) } },
    select: { id: true, title: true },
  });
  for (const t of tasks) {
    await prisma.task.update({ where: { id: t.id }, data: { estimateHours: estimates[t.title] } });
  }
  await linkDependencies(tasks, pairs);
}

async function main() {
  const admin = await upsertUser('admin@example.com', 'مدیر سیستم', 'Admin@12345', LEGACY_ADMIN_EMAIL);
  const sara = await upsertUser('sara@example.com', 'سارا احمدی', 'Sara@12345');
  const reza = await upsertUser('reza@example.com', 'رضا محمدی', 'Reza@12345');

  // ---- Website Redesign ------------------------------------------------------------------
  let website = await prisma.project.findFirst({ where: { name: 'Website Redesign', deletedAt: null } });
  if (!website) {
    website = await prisma.project.create({
      data: {
        name: 'Website Redesign',
        description: 'Sample project created by the seed script',
        ownerId: admin.id,
        members: { create: { userId: admin.id, role: 'OWNER' } },
      },
    });
    const websiteTasks = await createTasks(website.id, admin.id, [
      { title: 'Gather requirements', status: 'DONE', priority: 'HIGH', points: 3, assigneeId: admin.id, estimateHours: 8 },
      { title: 'Design wireframes', status: 'IN_PROGRESS', priority: 'HIGH', points: 5, assigneeId: sara.id, dueInDays: 2, estimateHours: 20 },
      { title: 'Build landing page', status: 'TODO', priority: 'MEDIUM', points: 8, assigneeId: sara.id, dueInDays: 9, estimateHours: 32 },
      { title: 'QA and launch', status: 'TODO', priority: 'URGENT', points: 3, dueInDays: 14, estimateHours: 12 },
    ]);
    await linkDependencies(websiteTasks, [
      ['Gather requirements', 'Design wireframes'],
      ['Design wireframes', 'Build landing page'],
      ['Build landing page', 'QA and launch'],
    ]);
  }
  await ensureMember(website.id, sara.id, 'MEMBER');
  await ensureMember(website.id, reza.id, 'VIEWER');
  await ensureSchedule(
    website.id,
    {
      'Gather requirements': 8,
      'Design wireframes': 20,
      'Build landing page': 32,
      'QA and launch': 12,
    },
    [
      ['Gather requirements', 'Design wireframes'],
      ['Design wireframes', 'Build landing page'],
      ['Build landing page', 'QA and launch'],
    ],
  );

  // ---- Mobile App Launch (rich demo data) -------------------------------------------------
  let mobile = await prisma.project.findFirst({ where: { name: 'Mobile App Launch', deletedAt: null } });
  if (!mobile) {
    mobile = await prisma.project.create({
      data: {
        name: 'Mobile App Launch',
        description: 'انتشار نسخه‌ی اول اپلیکیشن موبایل در بازار و اپ‌استور',
        ownerId: admin.id,
        startDate: daysFromNow(-20),
        endDate: daysFromNow(40),
        members: { create: { userId: admin.id, role: 'OWNER' } },
      },
    });
    await ensureMember(mobile.id, sara.id, 'ADMIN');
    await ensureMember(mobile.id, reza.id, 'MEMBER');
    const mobileTasks = await createTasks(mobile.id, admin.id, [
      {
        title: 'طراحی صفحه‌ی ورود',
        status: 'DONE',
        priority: 'HIGH',
        points: 5,
        assigneeId: sara.id,
        estimateHours: 16,
        tags: ['design', 'auth'],
      },
      {
        title: 'پیاده‌سازی API پرداخت',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        points: 8,
        assigneeId: reza.id,
        dueInDays: -1,
        estimateHours: 24,
        tags: ['backend', 'payment'],
        description: 'اتصال به درگاه پرداخت و مدیریت callback ها.',
        subtasks: [
          { title: 'دریافت کلید API از درگاه', done: true },
          { title: 'endpoint ساخت تراکنش', done: true },
          { title: 'مدیریت callback و تأیید پرداخت' },
        ],
        comments: [
          { authorId: sara.id, body: 'مستندات درگاه را در درایو گذاشتم.' },
          { authorId: reza.id, body: 'ممنون! تا فردا نسخه‌ی اول آماده است.' },
        ],
      },
      {
        title: 'Push notifications',
        status: 'REVIEW',
        priority: 'MEDIUM',
        points: 5,
        assigneeId: reza.id,
        dueInDays: 3,
        estimateHours: 12,
        tags: ['mobile'],
      },
      {
        title: 'نوشتن متن‌های فروشگاه',
        status: 'TODO',
        priority: 'LOW',
        points: 2,
        assigneeId: admin.id,
        dueInDays: 6,
        estimateHours: 6,
        tags: ['marketing'],
      },
      {
        title: 'تست بتا با ۵۰ کاربر',
        status: 'TODO',
        priority: 'HIGH',
        points: 8,
        assigneeId: sara.id,
        dueInDays: 12,
        estimateHours: 16,
        subtasks: [{ title: 'انتخاب کاربران بتا' }, { title: 'فرم بازخورد' }],
      },
      {
        title: 'انتشار در کافه‌بازار',
        status: 'TODO',
        priority: 'URGENT',
        points: 3,
        dueInDays: 20,
        estimateHours: 4,
      },
    ]);
    await linkDependencies(mobileTasks, [
      ['طراحی صفحه‌ی ورود', 'پیاده‌سازی API پرداخت'],
      ['پیاده‌سازی API پرداخت', 'تست بتا با ۵۰ کاربر'],
      ['Push notifications', 'تست بتا با ۵۰ کاربر'],
      ['تست بتا با ۵۰ کاربر', 'انتشار در کافه‌بازار'],
      ['نوشتن متن‌های فروشگاه', 'انتشار در کافه‌بازار'],
    ]);
  }
  await ensureSchedule(
    mobile.id,
    {
      'طراحی صفحه‌ی ورود': 16,
      'پیاده‌سازی API پرداخت': 24,
      'Push notifications': 12,
      'نوشتن متن‌های فروشگاه': 6,
      'تست بتا با ۵۰ کاربر': 16,
      'انتشار در کافه‌بازار': 4,
    },
    [
      ['طراحی صفحه‌ی ورود', 'پیاده‌سازی API پرداخت'],
      ['پیاده‌سازی API پرداخت', 'تست بتا با ۵۰ کاربر'],
      ['Push notifications', 'تست بتا با ۵۰ کاربر'],
      ['تست بتا با ۵۰ کاربر', 'انتشار در کافه‌بازار'],
      ['نوشتن متن‌های فروشگاه', 'انتشار در کافه‌بازار'],
    ],
  );

  // §3 official Iranian holidays (fixed Gregorian dates recur yearly; lunar ones are
  // re-imported manually each year — seed a reasonable recent-year baseline).
  const now = new Date();
  const years = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1];
  const fixedHolidays: [number, number, string][] = [
    // Nowruz + Nowruz holidays (approximate official range).
    [1, 1, 'نوروز'],
    [1, 2, 'عید نوروز'],
    [1, 3, 'عید نوروز'],
    [1, 4, 'عید نوروز'],
    [1, 12, 'روز جمهوری اسلامی'],
    [1, 13, 'سیزده‌بدر'],
    [3, 14, 'رحلت امام خمینی'],
    [3, 15, 'قیام ۱۵ خرداد'],
    [11, 22, 'پیروزی انقلاب اسلامی'],
    [12, 29, 'ملی‌شدن صنعت نفت'],
  ];
  // Lunar-shifted holidays already known for the current cycle (re-import yearly).
  const datedHolidays: [number, number, number, string][] = [
    [now.getUTCFullYear(), 2, 4, 'شهادت امام علی (ع)'],
    [now.getUTCFullYear(), 3, 3, 'اربعین حسینی'],
    [now.getUTCFullYear(), 6, 2, 'ولادت امام مهدی'],
    [now.getUTCFullYear(), 9, 19, 'شهادت امام رضا (ع)'],
    [now.getUTCFullYear(), 10, 26, 'نیمه شعبان'],
  ];
  for (const year of years) {
    for (const [month, day, title] of fixedHolidays) {
      const date = new Date(Date.UTC(year, month - 1, day));
      await prisma.holiday.upsert({
        where: { date },
        update: { title },
        create: { date, title, isRecurring: true },
      });
    }
  }
  for (const [year, month, day, title] of datedHolidays) {
    if (!years.includes(year)) continue;
    const date = new Date(Date.UTC(year, month - 1, day));
    await prisma.holiday.upsert({
      where: { date },
      update: { title },
      create: { date, title, isRecurring: false },
    });
  }

  console.log(
    `Seed complete: users ${admin.email}, ${sara.email}, ${reza.email}; projects "${website.name}", "${mobile.name}"; holidays ${await prisma.holiday.count()}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
