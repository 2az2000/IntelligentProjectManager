export const PROJECT_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

const RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

/** VIEWER < MEMBER < ADMIN < OWNER */
export const hasRole = (actual: ProjectRole, required: ProjectRole): boolean =>
  RANK[actual] >= RANK[required];
