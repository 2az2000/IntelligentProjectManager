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
  },
  comments: {
    byTask: (taskId: number) => ['comments', taskId] as const,
  },
  dashboard: ['dashboard'] as const,
};
