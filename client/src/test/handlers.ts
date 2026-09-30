import { http, HttpResponse } from 'msw';
import type { Project, ProjectMember, Teammate } from '@/features/projects/types';
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

export const handlers = [
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ id: 1, email: 'admin@example.com', name: admin.name, avatarUrl: null, locale: 'fa', theme: null }),
  ),
  http.get(`${API}/projects`, () => HttpResponse.json([project])),
  http.get(`${API}/projects/1`, () => HttpResponse.json(project)),
  http.get(`${API}/projects/1/members`, () => HttpResponse.json([projectMember])),
  http.get(`${API}/projects/1/tasks`, () => HttpResponse.json(tasks)),
  http.get(`${API}/me/team`, () => HttpResponse.json([teammate])),
];
