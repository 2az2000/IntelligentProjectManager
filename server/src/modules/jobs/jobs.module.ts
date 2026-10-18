import { Queue, Worker, type Job, type Processor } from 'bullmq';
import nodemailer, { type Transporter } from 'nodemailer';
import IORedis, { type Redis } from 'ioredis';
import { env, isTest } from '../../config/env';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import { publish } from '../../shared/realtime/bus';
import { buildDigest, type Digest, type DigestTask } from '../dashboard/digest';

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

/**
 * Digest email template (fa/en by recipient locale), rendered from the very same `Digest` the
 * in-app report shows — the mail and the modal must never disagree.
 */
function digestEmail(locale: string, name: string, digest: Digest) {
  const bullet = (task: DigestTask): string =>
    locale === 'fa'
      ? `- ${task.title} (${task.projectName})${task.overdueByDays > 0 ? ` — ${task.overdueByDays} روز عقب` : ''}`
      : `- ${task.title} (${task.projectName})${task.overdueByDays > 0 ? ` — ${task.overdueByDays}d overdue` : ''}`;
  const overdue = digest.tasks.filter((t) => t.overdue);
  const today = digest.tasks.filter((t) => !t.overdue);
  const lines = (rows: DigestTask[]): string => rows.slice(0, 5).map(bullet).join('\n');

  if (locale === 'fa') {
    const projects = digest.perProject
      .map((p) => `- ${p.projectName}: ${p.open} باز / ${p.overdue} عقب‌افتاده`)
      .join('\n');
    return {
      subject: `خلاصه‌ی روزانه ManageSys — ${digest.dueToday} کار برای امروز`,
      body: [
        `${name} عزیز،`,
        '',
        `کارهای باز: ${digest.open}`,
        `عقب‌افتاده: ${digest.overdue}${digest.overdueByDays > 0 ? ` (قدیمی‌ترین: ${digest.overdueByDays} روز)` : ''}`,
        `سررسید امروز: ${digest.dueToday}`,
        `سررسید ۷ روز آینده: ${digest.dueThisWeek}`,
        `در حال انجام: ${digest.inProgress}`,
        `از دیروز تا حالا تمام شده: ${digest.completedSinceYesterday}`,
        '',
        overdue.length > 0 ? `عقب‌افتاده‌ها:\n${lines(overdue)}` : '',
        today.length > 0 ? `برای امروز:\n${lines(today)}` : '',
        projects ? `به تفکیک پروژه:\n${projects}` : '',
        '',
        'ManageSys',
      ]
        .filter((line) => line !== '')
        .join('\n'),
    };
  }

  const projects = digest.perProject
    .map((p) => `- ${p.projectName}: ${p.open} open / ${p.overdue} overdue`)
    .join('\n');
  return {
    subject: `ManageSys daily digest — ${digest.dueToday} task(s) for today`,
    body: [
      `Hi ${name},`,
      '',
      `Open tasks: ${digest.open}`,
      `Overdue: ${digest.overdue}${digest.overdueByDays > 0 ? ` (oldest ${digest.overdueByDays}d)` : ''}`,
      `Due today: ${digest.dueToday}`,
      `Due in the next 7 days: ${digest.dueThisWeek}`,
      `In progress: ${digest.inProgress}`,
      `Completed since yesterday: ${digest.completedSinceYesterday}`,
      '',
      overdue.length > 0 ? `Overdue:\n${lines(overdue)}` : '',
      today.length > 0 ? `For today:\n${lines(today)}` : '',
      projects ? `By project:\n${projects}` : '',
      '',
      'ManageSys',
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

/** The lead plus every co-assignee, de-duplicated and in a stable order. */
const assigneeIdsOf = (task: {
  assigneeId: number | null;
  collaborators: { userId: number }[];
}): number[] => [
  ...(task.assigneeId === null ? [] : [task.assigneeId]),
  ...task.collaborators.map((c) => c.userId).filter((id) => id !== task.assigneeId),
];

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
      select: {
        title: true,
        dueDate: true,
        status: true,
        assigneeId: true,
        collaborators: { select: { userId: true }, orderBy: { id: 'asc' } },
        project: { select: { id: true, deletedAt: true } },
      },
    });
    if (!task || !task.dueDate || task.status === 'DONE' || task.project.deletedAt) return;
    const assigneeIds = assigneeIdsOf(task);
    if (assigneeIds.length === 0) return;
    if (task.dueDate.getTime() - Date.now() > 25 * 60 * 60 * 1000) return; // due moved away

    // Everyone on the task is reminded — not just the lead.
    const assignees = await db.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, email: true, locale: true, notifyEmail: true },
    });
    for (const assignee of assignees) {
      await db.notification.create({
        data: { userId: assignee.id, type: 'DUE_REMINDER', taskId: job.taskId },
      });
      publish('notification:new', { userId: assignee.id, type: 'DUE_REMINDER' });
      if (!assignee.notifyEmail) continue;
      const email = dueReminderEmail(assignee.locale, assignee.name, task.title, task.dueDate.toISOString());
      await mailer.sendMail({ from: 'noreply@managesys.local', to: assignee.email, subject: email.subject, text: email.body });
      logger.info({ to: assignee.email, subject: email.subject }, 'due reminder email (json transport)');
    }
  };

  const processDigest = async (db: Db) => {
    const users = await db.user.findMany({ where: { notifyEmail: true }, select: { id: true, name: true, email: true, locale: true } });

    for (const user of users) {
      const projectIds = (
        await db.projectMember.findMany({
          where: { userId: user.id, project: { deletedAt: null } },
          select: { projectId: true },
        })
      ).map((m) => m.projectId);
      const digest = await buildDigest(db, { userId: user.id, projectIds });
      // Nothing open: an empty digest is noise, so it is not delivered at all.
      if (digest.open === 0) continue;

      await db.notification.create({ data: { userId: user.id, type: 'DAILY_DIGEST' } });
      const email = digestEmail(user.locale, user.name, digest);
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
          select: {
            dueDate: true,
            status: true,
            assigneeId: true,
            collaborators: { select: { userId: true } },
          },
        });
        const jobId = `due-${taskId}`;
        await queue.remove(jobId).catch(() => undefined);
        if (!task?.dueDate || task.status === 'DONE') return;
        if (assigneeIdsOf(task).length === 0) return;
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
