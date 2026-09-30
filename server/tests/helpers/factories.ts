import type { ProjectRole, TaskStatus } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { hashPassword } from '../../src/modules/auth';
import { prisma } from './db';

let seq = 0;
const next = () => ++seq;

export const TEST_PASSWORD = 'Password123!';

export async function createUser(overrides: { email?: string; name?: string } = {}) {
  const n = next();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${n}@test.dev`,
      name: overrides.name ?? `User ${n}`,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
}

export async function createProject(ownerId: number, overrides: { name?: string } = {}) {
  return prisma.project.create({
    data: {
      name: overrides.name ?? `Project ${next()}`,
      ownerId,
      members: { create: { userId: ownerId, role: 'OWNER' } },
    },
  });
}

export function addMember(projectId: number, userId: number, role: ProjectRole) {
  return prisma.projectMember.create({ data: { projectId, userId, role } });
}

export async function createTask(data: {
  projectId: number;
  authorId: number;
  title?: string;
  status?: TaskStatus;
  position?: number;
  parentId?: number;
  assigneeId?: number;
  dueDate?: Date;
  points?: number;
}) {
  return prisma.task.create({
    data: {
      projectId: data.projectId,
      authorId: data.authorId,
      title: data.title ?? `Task ${next()}`,
      status: data.status ?? 'TODO',
      priority: 'MEDIUM',
      position: data.position ?? next() * 1024,
      parentId: data.parentId,
      assigneeId: data.assigneeId,
      dueDate: data.dueDate,
      points: data.points,
    },
  });
}

/** Returns a supertest agent that carries the auth cookies of a freshly logged-in user. */
export async function loginAs(app: App, email: string, password = TEST_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
