import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDigest } from '../../src/modules/dashboard/digest';
import { prisma, resetDb } from '../helpers/db';
import { createProject, createTask, createUser } from '../helpers/factories';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// 09:30 on Sunday 2026-10-25 in Tehran (UTC+3:30).
const NOW = new Date('2026-10-25T06:00:00.000Z');

describe('digest time zone', () => {
  it('decides "today" in the requested zone, not in the server zone', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    // 01:00 on the 26th in Tehran — after the Tehran day ends but inside the UTC day.
    await createTask({
      projectId: project.id,
      authorId: me.id,
      assigneeId: me.id,
      title: 'Early morning next day',
      dueDate: new Date('2026-10-25T21:30:00.000Z'),
    });

    const tehran = await buildDigest(prisma, {
      userId: me.id,
      projectIds: [project.id],
      now: NOW,
      timeZone: 'Asia/Tehran',
    });
    const utc = await buildDigest(prisma, {
      userId: me.id,
      projectIds: [project.id],
      now: NOW,
      timeZone: 'UTC',
    });

    expect(tehran.dueToday).toBe(0);
    expect(utc.dueToday).toBe(1);
  });

  it('counts overdue days midnight-to-midnight in that zone', async () => {
    const me = await createUser();
    const project = await createProject(me.id);
    // 00:30 on the 24th in Tehran, 21:00 on the 23rd in UTC.
    await createTask({
      projectId: project.id,
      authorId: me.id,
      assigneeId: me.id,
      title: 'Late from the 24th',
      dueDate: new Date('2026-10-23T21:00:00.000Z'),
    });

    const overdueDays = async (timeZone: string) => {
      const digest = await buildDigest(prisma, {
        userId: me.id,
        projectIds: [project.id],
        now: NOW,
        timeZone,
      });
      return digest.tasks.find((task) => task.title === 'Late from the 24th')?.overdueByDays;
    };

    expect(await overdueDays('Asia/Tehran')).toBe(1);
    expect(await overdueDays('UTC')).toBe(2);
  });
});
