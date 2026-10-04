import { Queue, Worker, type Job, type Processor } from 'bullmq';
import nodemailer, { type Transporter } from 'nodemailer';
import IORedis, { type Redis } from 'ioredis';
import { env, isTest } from '../../config/env';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import { publish } from '../../shared/realtime/bus';

const QUEUE_NAME = 'notifications';

export interface Jobs {
  /** (Re)schedules the 24h-before-due reminder for a task (no-op when jobs are off). */
  scheduleDueReminder(taskId: number): Promise<void>;
  close(): Promise<void>;
}

interface ReminderJobData {
  type: 'DUE_REMINDER';
  taskId: number;
}
interface DigestJobData {
  type: 'DAILY_DIGEST';
}

type JobData = ReminderJobData | DigestJobData;

/** Digest + reminder email templates (fa/en by recipient locale). */
function digestEmail(locale: string, name: string, stats: { open: number; overdue: number; dueToday: number }) {
  if (locale === 'fa') {
    return {
      subject: 'خلاصه‌ی روزانه ManageSys',
      body: `${name} عزیز،\n\nکارهای باز: ${stats.open}\nعقب‌افتاده: ${stats.overdue}\nسررسید امروز: ${stats.dueToday}\n`,
    };
  }
  return {
    subject: 'ManageSys daily digest',
    body: `Hi ${name},\n\nOpen tasks: ${stats.open}\nOverdue: ${stats.overdue}\nDue today: ${stats.dueToday}\n`,
  };
}

function dueReminderEmail(locale: string, name: string, taskTitle: string, dueIso: string) {
  const due = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'full' }).format(
    new Date(dueIso),
  );
  if (locale === 'fa') {
    return { subject: `یادآوری: «${taskTitle}» فردا سررسید می‌شود`, body: `${name} عزیز، تسک «${taskTitle}» تا ${due} سررسید است.\n` };
  }
  return { subject: `Reminder: "${taskTitle}" is due tomorrow`, body: `Hi ${name}, the task "${taskTitle}" is due ${due}.\n` };
}

export function createJobsModule(deps: { db: Db }): Jobs {
  // Tests (and any deployment without redis) run without background jobs.
  if (isTest || !env.JOBS_ENABLED) {
    return { scheduleDueReminder: async () => undefined, close: async () => undefined };
  }

  const connection: Redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err: Error) => logger.warn({ err }, 'Redis connection issue (jobs degraded)'));

  const queue = new Queue<JobData>(QUEUE_NAME, { connection });

  // Dev "SMTP": jsonTransport logs the email instead of sending it.
  const mailer: Transporter = nodemailer.createTransport({ jsonTransport: true });

  const processReminder = async (db: Db, job: ReminderJobData) => {
    const task = await db.task.findFirst({
      where: { id: job.taskId, deletedAt: null },
      select: { title: true, dueDate: true, status: true, assigneeId: true, project: { select: { id: true, deletedAt: true } } },
    });
    if (!task || !task.dueDate || task.status === 'DONE' || !task.assigneeId || task.project.deletedAt) return;
    if (task.dueDate.getTime() - Date.now() > 25 * 60 * 60 * 1000) return; // due moved away

    const assignee = await db.user.findUnique({ where: { id: task.assigneeId }, select: { id: true, name: true, email: true, locale: true, notifyEmail: true } });
    if (!assignee) return;

    await db.notification.create({
      data: { userId: assignee.id, type: 'DUE_REMINDER', taskId: job.taskId },
    });
    publish('notification:new', { userId: assignee.id, type: 'DUE_REMINDER' });
    if (assignee.notifyEmail) {
      const email = dueReminderEmail(assignee.locale, assignee.name, task.title, task.dueDate.toISOString());
      await mailer.sendMail({ from: 'noreply@managesys.local', to: assignee.email, subject: email.subject, text: email.body });
      logger.info({ to: assignee.email, subject: email.subject }, 'due reminder email (json transport)');
    }
  };

  const processDigest = async (db: Db) => {
    const users = await db.user.findMany({ where: { notifyEmail: true }, select: { id: true, name: true, email: true, locale: true } });
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const now = new Date();

    for (const user of users) {
      const projectIds = (await db.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true } })).map((m) => m.projectId);
      if (projectIds.length === 0) continue;
      const tasks = await db.task.findMany({
        where: { assigneeId: user.id, deletedAt: null, status: { not: 'DONE' }, project: { id: { in: projectIds }, deletedAt: null } },
        select: { dueDate: true },
      });
      const stats = {
        open: tasks.length,
        overdue: tasks.filter((t) => t.dueDate && t.dueDate < now).length,
        dueToday: tasks.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= dayEnd).length,
      };
      if (stats.open === 0) continue;

      await db.notification.create({ data: { userId: user.id, type: 'DAILY_DIGEST' } });
      const email = digestEmail(user.locale, user.name, stats);
      await mailer.sendMail({ from: 'noreply@managesys.local', to: user.email, subject: email.subject, text: email.body });
      logger.info({ to: user.email, subject: email.subject }, 'daily digest email (json transport)');
    }
  };

  const processor: Processor<JobData> = async (job: Job<JobData>) => {
    if (job.data.type === 'DUE_REMINDER') return processReminder(deps.db, job.data);
    return processDigest(deps.db);
  };

  const worker = new Worker<JobData>(QUEUE_NAME, processor, { connection });
  worker.on('failed', (job, err) => logger.warn({ jobId: job?.id, err }, 'Job failed'));

  // Daily digest at 08:00 server time (repeatable, deduplicated by jobId).
  void queue
    .add('daily-digest', { type: 'DAILY_DIGEST' } satisfies DigestJobData, {
      jobId: 'daily-digest',
      repeat: { pattern: '0 8 * * *' },
      removeOnComplete: true,
    })
    .catch((err: unknown) => logger.warn({ err }, 'Failed to schedule digest job'));

  return {
    async scheduleDueReminder(taskId: number) {
      try {
        const task = await deps.db.task.findFirst({
          where: { id: taskId, deletedAt: null },
          select: { dueDate: true, status: true, assigneeId: true },
        });
        const jobId = `due-${taskId}`;
        await queue.remove(jobId).catch(() => undefined);
        if (!task?.dueDate || task.status === 'DONE' || !task.assigneeId) return;
        const delay = task.dueDate.getTime() - 24 * 60 * 60 * 1000 - Date.now();
        if (delay <= 0) return; // already inside the reminder window / past due
        await queue.add('due-reminder', { type: 'DUE_REMINDER', taskId }, { jobId, delay, removeOnComplete: true });
      } catch (err) {
        logger.warn({ err }, 'Failed to schedule due reminder');
      }
    },

    async close() {
      await worker.close();
      await queue.close();
      connection.disconnect();
    },
  };
}
