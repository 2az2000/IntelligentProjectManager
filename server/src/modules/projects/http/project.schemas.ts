import {
  addMemberPayloadSchema,
  createProjectPayloadSchema,
  fromTemplatePayloadSchema,
  updateMemberPayloadSchema,
  updateProjectPayloadSchema,
} from '@managesys/contracts';
import { z } from 'zod';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });
export const memberParams = z.object({ projectId: id, userId: id });

// Payload shapes live in @managesys/contracts — the client's settings forms are typed from the
// same definitions, so a field rename breaks `tsc` on both sides instead of 400-ing in production.
export const createProjectBody = createProjectPayloadSchema(z);
export const updateProjectBody = updateProjectPayloadSchema(z);
export const addMemberBody = addMemberPayloadSchema(z);
export const updateMemberBody = updateMemberPayloadSchema(z);
/** §11: createProjectBody + the chosen template id. */
export const fromTemplateBody = fromTemplatePayloadSchema(z);

/** §Imp #4: GET /me/team/workload?weeks=8 — 1..26 seven-day windows from today. */
export const teamWorkloadQuery = z
  .object({
    weeks: z.coerce.number().int().min(1).max(26).default(8),
  })
  .strict();
