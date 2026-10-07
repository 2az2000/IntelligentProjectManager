import { http, HttpResponse } from 'msw';
import type { ActivityEntry } from '@/features/activity/types';
import type { Attachment } from '@/features/attachments/types';
import type { ProjectDoc, TaskEnrichment } from '@/features/ai/types';
import type { Notification } from '@/features/notifications/types';
import type { Project, ProjectMember, Teammate } from '@/features/projects/types';
import type { ScheduleResult } from '@/features/scheduling/types';
import type { BurndownResult, ForecastResult, RiskResult } from '@/features/scheduling/analytics-types';
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
  stats: { total: 3, done: 1, overdue: 0, subtaskProgress: [] },
  createdAt: now,
  updatedAt: now,
};

export const projectMember: ProjectMember = {
  user: adminWithEmail,
  role: 'OWNER',
  skills: ['backend', 'api'],
  joinedAt: now,
  openTasks: 1,
  openPoints: 5,
  capacityHoursPerWeek: 35,
  openEstimateHours: 24,
};

export const teammate: Teammate = {
  user: saraWithEmail,
  projectCount: 1,
  openTasks: 1,
  openPoints: 3,
  overdueTasks: 0,
};

export const task = (overrides: Partial<Task>): Task => ({
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

/** §11 built-in template fixture (mirrors server/templates.ts). */
export const softwareLaunchTemplate = {
  id: 'software-launch',
  name: 'راه‌اندازی محصول نرم‌افزاری',
  nameEn: 'Software product launch',
  description: 'از طراحی تا انتشار.',
  tasks: [
    { title: 'طراحی وایرفریم', priority: 'HIGH', estimateHours: 16 },
    { title: 'پیاده‌سازی فرانت‌اند', priority: 'HIGH', estimateHours: 60, dependsOn: ['طراحی وایرفریم'] },
  ],
};

export const notifications: Notification[] = [
  {
    id: 11,
    type: 'ASSIGNED',
    actor: sara,
    task: { id: 1, title: 'Design hero section', projectId: 1, projectName: project.name },
    read: false,
    createdAt: '2026-09-30T09:00:00.000Z',
  },
  {
    id: 12,
    type: 'MENTIONED',
    actor: sara,
    task: { id: 1, title: 'Design hero section', projectId: 1, projectName: project.name },
    read: true,
    createdAt: '2026-09-29T15:00:00.000Z',
  },
];

export const activityEntries: ActivityEntry[] = [
  {
    id: 21,
    taskId: 1,
    action: 'updated',
    field: 'status',
    oldValue: 'TODO',
    newValue: 'IN_PROGRESS',
    actor: sara,
    createdAt: '2026-09-30T09:30:00.000Z',
  },
  {
    id: 22,
    taskId: 1,
    action: 'created',
    field: null,
    oldValue: null,
    newValue: null,
    actor: admin,
    createdAt: '2026-09-30T08:00:00.000Z',
  },
];

export const attachments: Attachment[] = [
  {
    id: 31,
    taskId: 1,
    fileName: 'hero-brief.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    uploader: sara,
    createdAt: '2026-09-30T09:00:00.000Z',
  },
];

export const handlers = [
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({
      id: 1,
      email: 'admin@example.com',
      name: admin.name,
      avatarUrl: null,
      locale: 'fa',
      theme: null,
      notifyEmail: true,
    }),
  ),
  http.get(`${API}/projects`, () => HttpResponse.json([project])),
  http.get(`${API}/projects/1`, () => HttpResponse.json(project)),
  http.get(`${API}/projects/templates`, () => HttpResponse.json([softwareLaunchTemplate])),
  http.get(`${API}/projects/1/members`, () => HttpResponse.json([projectMember])),
  http.get(`${API}/projects/1/tasks`, () => HttpResponse.json(tasks)),
  http.get(`${API}/projects/1/tasks/trash`, () => HttpResponse.json([])),
  http.post(`${API}/projects/1/tasks/trash/:taskId/restore`, ({ params }) =>
    HttpResponse.json(task({ id: Number(params.taskId), title: 'Restored task' })),
  ),
  http.post(`${API}/projects/1/tasks`, async ({ request }) => {
    const body = (await request.json()) as { title: string; parentId?: number | null };
    return HttpResponse.json(task({ id: body.parentId ?? 1000, title: body.title, parentId: body.parentId ?? null }), {
      status: 201,
    });
  }),
  http.get(`${API}/projects/1/schedule`, () => HttpResponse.json(schedule)),
  http.post(`${API}/projects/1/schedule/apply`, () => HttpResponse.json(schedule)),
  http.get(`${API}/projects/1/dependencies`, () => HttpResponse.json(dependencies)),
  http.post(`${API}/projects/1/dependencies`, () =>
    HttpResponse.json({ predecessorId: 2, successorId: 1, type: 'FINISH_TO_START' }, { status: 201 }),
  ),
  http.delete(`${API}/projects/1/dependencies/:predecessorId/:successorId`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/me/team`, () => HttpResponse.json([teammate])),

  // ---- phase 5: notifications, activity, attachments ------------------------------------
  http.get(`${API}/notifications`, () => HttpResponse.json(notifications)),
  http.get(`${API}/notifications/unread-count`, () =>
    HttpResponse.json({ count: notifications.filter((n) => !n.read).length }),
  ),
  http.post(`${API}/notifications/read-all`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API}/notifications/:id/read`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/tasks/1/activity`, () => HttpResponse.json(activityEntries)),
  http.get(`${API}/tasks/1/attachments`, () => HttpResponse.json(attachments)),
  http.post(`${API}/tasks/1/attachments`, () =>
    HttpResponse.json(
      {
        ...attachments[0],
        id: 32,
        fileName: 'uploaded.txt',
        mimeType: 'text/plain',
        size: 13,
        uploader: adminWithEmail,
        createdAt: '2026-09-30T10:00:00.000Z',
      } satisfies Attachment,
      { status: 201 },
    ),
  ),
  http.delete(`${API}/attachments/:id`, () => new HttpResponse(null, { status: 204 })),

  // ---- phase 7: AI previews (no writes, the user applies suggestions themselves) --------
  http.post(`${API}/projects/1/ai/enrich-task`, () =>
    HttpResponse.json({
      description: 'AI-written description for the rough task.',
      subtasks: ['Draft the outline', 'Implement the design', 'Review and polish'],
      suggestedAssignees: [{ userId: 2, name: sara.name, reason: 'Has design experience' }],
      estimateHours: 8,
    } satisfies TaskEnrichment),
  ),
  http.post(`${API}/projects/1/ai/project-doc`, () =>
    HttpResponse.json({
      markdown: '# Website Redesign\n\n## Overview\nGenerated by AI from project data.',
      model: 'llama-3.3-70b-versatile',
    } satisfies ProjectDoc),
  ),
  http.patch(`${API}/users/me`, () =>
    HttpResponse.json({
      id: 1,
      email: 'admin@example.com',
      name: admin.name,
      avatarUrl: null,
      locale: 'fa',
      theme: null,
      notifyEmail: false,
    }),
  ),

  // ---- §3 analytics: forecast / risks / burndown ----------------------------------------
  http.get(`${API}/projects/1/forecast`, () =>
    HttpResponse.json({
      runs: 2000,
      p50Hours: 30,
      p85Hours: 36,
      p95Hours: 42,
      p50Date: '2026-10-08T00:00:00.000Z',
      p85Date: '2026-10-10T00:00:00.000Z',
      p95Date: '2026-10-12T00:00:00.000Z',
      deadlineProbability: 0.72,
      tasks: [{ taskId: 1, criticality: 0.98 }],
    } satisfies ForecastResult),
  ),
  http.get(`${API}/projects/1/risks`, () =>
    HttpResponse.json({
      generatedAt: now,
      tasks: [
        {
          taskId: 1,
          score: 58,
          reasons: ['critical', 'due-soon'],
          title: 'Design hero section',
          status: 'IN_PROGRESS',
        },
        { taskId: 2, score: 0, reasons: [], title: 'Set up CI', status: 'DONE' },
      ],
    } satisfies RiskResult),
  ),
  http.get(`${API}/projects/1/burndown`, () =>
    HttpResponse.json({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
      total: 3,
      points: [
        { date: '2026-09-01T00:00:00.000Z', remaining: 3, ideal: 3 },
        { date: '2026-09-15T00:00:00.000Z', remaining: 2, ideal: 1.5 },
        { date: '2026-09-30T00:00:00.000Z', remaining: 1, ideal: 0 },
      ],
    } satisfies BurndownResult),
  ),
  http.get(`${API}/holidays`, () =>
    HttpResponse.json([
      { date: '2027-03-21T00:00:00.000Z', title: 'نوروز', isRecurring: true },
    ]),
  ),

  // ---- §6 time tracking + cost -----------------------------------------------------------
  http.get(`${API}/me/timer`, () => HttpResponse.json(null)),
  http.post(`${API}/tasks/1/time/start`, () =>
    HttpResponse.json(
      { id: 77, taskId: 1, userId: 1, startedAt: now, endedAt: null, minutes: 0, manual: false },
      { status: 201 },
    ),
  ),
  http.post(`${API}/tasks/1/time/stop`, () =>
    HttpResponse.json({ id: 77, taskId: 1, userId: 1, startedAt: now, endedAt: now, minutes: 45, manual: false }),
  ),
  http.post(`${API}/tasks/1/time/manual`, () =>
    HttpResponse.json(
      { id: 78, taskId: 1, userId: 1, startedAt: now, endedAt: now, minutes: 30, manual: true },
      { status: 201 },
    ),
  ),
  http.get(`${API}/tasks/1/time`, () =>
    HttpResponse.json([
      { id: 77, taskId: 1, userId: 1, startedAt: now, endedAt: now, minutes: 45, manual: false },
    ]),
  ),
  http.get(`${API}/me/time-summary`, () =>
    HttpResponse.json({
      weekStart: '2026-09-28T00:00:00.000Z',
      totalMinutes: 195,
      perDay: [{ date: '2026-09-30', minutes: 45 }],
      perTask: [{ taskId: 1, taskTitle: 'Design hero section', minutes: 45 }],
    }),
  ),
  http.get(`${API}/projects/1/cost`, () =>
    HttpResponse.json({
      bookedCost: 1170,
      trackedMinutes: 1170,
      unpricedMinutes: 0,
      budget: 5000,
      hourlyRate: 60,
      perMember: [{ userId: 1, name: admin.name, minutes: 1170, hourlyRate: 60, cost: 1170 }],
    }),
  ),
  http.get(`${API}/projects/1/tasks/unassigned`, () => HttpResponse.json([])),
  http.post(`${API}/projects/1/tasks/bulk`, () => HttpResponse.json({ updated: 2, skipped: [] })),
  http.get(`${API}/search`, () =>
    HttpResponse.json({
      tasks: [{ id: 1, projectId: 1, projectTitle: project.name, title: 'Design hero section', status: 'TODO' }],
      projects: [{ id: 1, title: project.name }],
      comments: [],
    }),
  ),
];
