/**
 * `@managesys/contracts` — the shared HTTP contract.
 *
 * Every schema here is used by the server for request validation *and* by the client for its
 * forms/types, so the two apps cannot disagree about a payload without failing `tsc`.
 */
export * from './task';
export * from './project';
export * from './activity';
export * from './user';
