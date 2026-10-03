import { http, HttpResponse } from 'msw';
import type { Project, ProjectMember, Teammate } from '@/features/projects/types';
import type { ScheduleResult } from '@/features/scheduling/types';
import type { Task } from '@/features/tasks/types';

export const API = 'http://localhost:8000';

export const admin = { id: 1, name: 'Amir Admin', avatarUrl: null };
export const sara = { id: 2, name: 'Sara Member', avatarUrl: null };
const adminWithEmail = { ...admin, email: 'admin@example.com' };
const saraWithEmail = { ...sara, email: 'sara@example.com' };

const now = '2026-09-30T10:00:00.000Z';

export const project: Project = {
  id: 1,
  name: 'Website Redesign',
  description: 'Marketing site refresh',
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: '2026-10-15T00:00:00.000Z',
  ownerId: 1,
  myRole: 'OWNER',
  owner: admin,
  memberCount: 2,
  stats: { total: 3, done: 1, overdue: 0 },
  createdAt: now,
  updatedAt: now,
};

export const projectMember: ProjectMember = {
  user: adminWithEmail,
  role: 'OWNER',
  joinedAt: now,
  openTasks: 1,
  openPoints: 5,
};

export const teammate: Teammate = {
  user: saraWithEmail,
  projectCount: 1,
  openTasks: 1,
  openPoints: 3,
  overdueTasks: 0,
};

const task = (overrides: Partial<Task>): Task => ({
  id: 0,
  projectId: 1,
  project: { id: 1, name: project.name },
  parentId: null,
  title: '',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  position: 1024,
  tags: [],
  points: null,
  estimateHours: null,
  startDate: null,
  dueDate: null,
  completedAt: null,
  author: admin,
  assignee: null,
  subtaskCount: 0,
  doneSubtaskCount: 0,
  commentCount: 0,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const tasks: Task[] = [
  task({
    id: 1,
    title: 'Design hero section',
    description: 'Landing hero with RTL support',
    status: 'TODO',
    priority: 'HIGH',
    points: 5,
    dueDate: '2026-10-01T00:00:00.000Z',
    tags: ['design'],
    assignee: admin,
  }),
  task({
    id: 2,
    title: 'Set up CI',
    status: 'DONE',
    position: 2048,
    points: 3,
    completedAt: '2026-09-21T08:00:00.000Z',
    assignee: sara,
  }),
];

/** Seed-shaped CPM result for project 1: A (24h) is critical, the DONE task never is. */
export const schedule: ScheduleResult = {
  projectDurationHours: 24,
  criticalPath: [1],
  tasks: [
    {
      id: 1,
      title: 'Design hero section',
      status: 'IN_PROGRESS',
      estimateHours: 24,
      startDate: '2026-09-01T00:00:00.000Z',
      dueDate: '2026-10-01T00:00:00.000Z',
      earliestStart: 0,
      earliestFinish: 24,
      latestStart: 0,
      latestFinish: 24,
      slack: 0,
      isCritical: true,
      scheduledStart: '2026-09-01T08:00:00.000Z',
      scheduledFinish: '2026-09-02T08:00:00.000Z',
    },
    {
      id: 2,
      title: 'Set up CI',
      status: 'DONE',
      estimateHours: 8,
      startDate: null,
      dueDate: null,
      earliestStart: 24,
      earliestFinish: 24,
      latestStart: 64,
      latestFinish: 64,
      slack: 40,
      isCritical: false,
      scheduledStart: null,
      scheduledFinish: null,
    },
  ],
  unestimatedTaskIds: [],
};

export const dependencies = [{ predecessorId: 1, successorId: 2, type: 'FINISH_TO_START' as const }];

export const handlers = [
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ id: 1, email: 'admin@example.com', name: admin.name, avatarUrl: null, locale: 'fa', theme: null }),
  ),
  http.get(`${API}/projects`, () => HttpResponse.json([project])),
  http.get(`${API}/projects/1`, () => HttpResponse.json(project)),
  http.get(`${API}/projects/1/members`, () => HttpResponse.json([projectMember])),
  http.get(`${API}/projects/1/tasks`, () => HttpResponse.json(tasks)),
  http.get(`${API}/projects/1/schedule`, () => HttpResponse.json(schedule)),
  http.post(`${API}/projects/1/schedule/apply`, () => HttpResponse.json(schedule)),
  http.get(`${API}/projects/1/dependencies`, () => HttpResponse.json(dependencies)),
  http.post(`${API}/projects/1/dependencies`, () =>
    HttpResponse.json({ predecessorId: 2, successorId: 1, type: 'FINISH_TO_START' }, { status: 201 }),
  ),
  http.delete(`${API}/projects/1/dependencies/:predecessorId/:successorId`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/me/team`, () => HttpResponse.json([teammate])),
];
