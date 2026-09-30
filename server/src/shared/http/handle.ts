import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z, ZodType } from 'zod';

type Schemas = { params?: ZodType; query?: ZodType; body?: ZodType };
type Out<S extends Schemas, K extends keyof Schemas> = S[K] extends ZodType ? z.output<S[K]> : undefined;

export interface Input<S extends Schemas> {
  params: Out<S, 'params'>;
  query: Out<S, 'query'>;
  body: Out<S, 'body'>;
}

/**
 * Validates params/query/body with Zod and passes the typed result to the handler.
 * ZodErrors propagate to the global error handler (400 VALIDATION_ERROR).
 * Express 5 forwards rejected promises to the error handler, so no try/catch is needed.
 */
export function handle<S extends Schemas>(
  schemas: S,
  fn: (input: Input<S>, req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return async (req, res, next) => {
    const input = {
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
    } as Input<S>; // safe: each field is the parse output of its schema (or undefined when absent)
    await fn(input, req, res, next);
  };
}
