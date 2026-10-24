import type { ActivityPage, ProjectDto, TaskDto } from '@managesys/contracts';
import type { components } from './api-types';

/**
 * Compile-time link between the generated OpenAPI document and `@managesys/contracts`.
 *
 * `api-types.ts` is what `/docs.json` actually serves; the contracts are what both apps code
 * against. These assertions make a drifted DTO a `tsc` failure in CI instead of a runtime
 * `undefined` on a board card.
 */
type Schemas = components['schemas'];

/** Exact type equality (not just assignability: an extra or missing field must fail). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;

export type TaskMatchesContract = Expect<Equal<Schemas['Task'], TaskDto>>;
export type ProjectMatchesContract = Expect<Equal<Schemas['Project'], ProjectDto>>;
export type ActivityPageMatchesContract = Expect<Equal<Schemas['ActivityPage'], ActivityPage>>;
