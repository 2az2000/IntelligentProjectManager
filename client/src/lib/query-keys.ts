/** Single source of truth for TanStack Query keys. */
export const qk = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    search: (query: string) => ['users', 'search', query] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (projectId: number) => ['projects', 'detail', projectId] as const,
    members: (projectId: number) => ['projects', 'members', projectId] as const,
  },
  team: ['team'] as const,
  tasks: {
    all: ['tasks'] as const,
    byProject: (projectId: number) => ['tasks', 'project', projectId] as const,
    detail: (taskId: number) => ['tasks', 'detail', taskId] as const,
    mine: (includeDone: boolean) => ['tasks', 'mine', includeDone] as const,
    calendar: (from: string, to: string, scope: string) => ['tasks', 'calendar', from, to, scope] as const,
    trash: (projectId: number) => ['tasks', 'trash', projectId] as const,
  },
  comments: {
    byTask: (taskId: number) => ['comments', taskId] as const,
  },
  schedule: {
    all: ['schedule'] as const,
    byProject: (projectId: number) => ['schedule', 'project', projectId] as const,
    byTask: (taskId: number) => ['schedule', 'task', taskId] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    forecast: (projectId: number) => ['analytics', 'forecast', projectId] as const,
    risks: (projectId: number) => ['analytics', 'risks', projectId] as const,
    burndown: (projectId: number) => ['analytics', 'burndown', projectId] as const,
  },
  time: {
    all: ['time'] as const,
    openTimer: ['time', 'open-timer'] as const,
    weekly: ['time', 'weekly'] as const,
    byTask: (taskId: number) => ['time', 'task', taskId] as const,
  },
  cost: {
    all: ['cost'] as const,
    byProject: (projectId: number) => ['cost', projectId] as const,
  },
  search: (query: string) => ['search', query] as const,
  holidays: ['holidays'] as const,
  unassigned: (projectId: number) => ['tasks', 'unassigned', projectId] as const,
  dependencies: {
    all: ['dependencies'] as const,
    byProject: (projectId: number) => ['dependencies', 'project', projectId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (limit: number) => ['notifications', 'list', limit] as const,
    unread: ['notifications', 'unread'] as const,
  },
  activity: {
    byTask: (taskId: number) => ['activity', taskId] as const,
  },
  attachments: {
    byTask: (taskId: number) => ['attachments', taskId] as const,
  },
  dashboard: ['dashboard'] as const,
};
