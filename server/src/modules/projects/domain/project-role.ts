import { PROJECT_ROLES, hasRole } from '@managesys/contracts';
import type { ProjectRole } from '@managesys/contracts';

// Roles and their ranking live in @managesys/contracts — the client gates the very same UI with it.
export { PROJECT_ROLES, hasRole };
export type { ProjectRole };
