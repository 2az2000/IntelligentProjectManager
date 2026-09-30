import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError, z } from 'zod';
import { AppError, NotFoundError } from '../errors';
import { logger } from '../logger';

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid request', z.flattenError(err));
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return new AppError(409, 'UNIQUE_CONSTRAINT', 'A record with this value already exists', {
          target: err.meta?.target,
        });
      case 'P2003':
        return new AppError(409, 'FOREIGN_KEY_CONSTRAINT', 'Related record does not exist or is still in use');
      case 'P2025':
        return new NotFoundError();
    }
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return new AppError(400, 'INVALID_JSON', 'Malformed JSON body');
  }
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);
  const requestId = String(req.id ?? '');

  if (!appError || appError.statusCode >= 500) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
  }

  const error = appError ?? new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
  res.status(error.statusCode).json({
    error: { code: error.code, message: error.message, details: error.details ?? null, requestId },
  });
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};
