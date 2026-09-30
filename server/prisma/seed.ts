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
  tags?: string[];
  description?: string;
  subtasks?: { title: string; done?: boolean }[];
  comments?: { authorId: number; body: string }[];
}

async function createTasks(projectId: number, authorId: number, tasks: SeedTask[]) {
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
      dueDate: t.dueInDays !== undefined ? daysFromNow(t.dueInDays) : null,
      completedAt: t.status === 'DONE' ? daysFromNow(-2) : null,
      tags: t.tags ?? [],
      position,
    };
    const task = await prisma.task.create({ data });
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
    await createTasks(website.id, admin.id, [
      { title: 'Gather requirements', status: 'DONE', priority: 'HIGH', points: 3, assigneeId: admin.id },
      { title: 'Design wireframes', status: 'IN_PROGRESS', priority: 'HIGH', points: 5, assigneeId: sara.id, dueInDays: 2 },
      { title: 'Build landing page', status: 'TODO', priority: 'MEDIUM', points: 8, assigneeId: sara.id, dueInDays: 9 },
      { title: 'QA and launch', status: 'TODO', priority: 'URGENT', points: 3, dueInDays: 14 },
    ]);
  }
  await ensureMember(website.id, sara.id, 'MEMBER');
  await ensureMember(website.id, reza.id, 'VIEWER');

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
    await createTasks(mobile.id, admin.id, [
      {
        title: 'طراحی صفحه‌ی ورود',
        status: 'DONE',
        priority: 'HIGH',
        points: 5,
        assigneeId: sara.id,
        tags: ['design', 'auth'],
      },
      {
        title: 'پیاده‌سازی API پرداخت',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        points: 8,
        assigneeId: reza.id,
        dueInDays: -1,
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
        tags: ['mobile'],
      },
      {
        title: 'نوشتن متن‌های فروشگاه',
        status: 'TODO',
        priority: 'LOW',
        points: 2,
        assigneeId: admin.id,
        dueInDays: 6,
        tags: ['marketing'],
      },
      {
        title: 'تست بتا با ۵۰ کاربر',
        status: 'TODO',
        priority: 'HIGH',
        points: 8,
        assigneeId: sara.id,
        dueInDays: 12,
        subtasks: [{ title: 'انتخاب کاربران بتا' }, { title: 'فرم بازخورد' }],
      },
      { title: 'انتشار در کافه‌بازار', status: 'TODO', priority: 'URGENT', points: 3, dueInDays: 20 },
    ]);
  }

  console.log(
    `Seed complete: users ${admin.email}, ${sara.email}, ${reza.email}; projects "${website.name}", "${mobile.name}".`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
