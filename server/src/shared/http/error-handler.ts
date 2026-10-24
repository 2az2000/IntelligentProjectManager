import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError, z } from 'zod';
import { AppError, NotFoundError } from '../errors';
import { logger } from '../logger';

/**
 * `@managesys/contracts` builds its schemas with the zod instance the caller passes in, so a
 * validation error can come from an equal-but-distinct `ZodError` class. Duck-type the shape
 * instead of relying on `instanceof` alone, otherwise shared schemas would 500 instead of 400.
 */
const isZodError = (err: unknown): err is ZodError =>
  err instanceof ZodError ||
  (typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((err as { issues?: unknown }).issues));

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (isZodError(err)) {
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
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(413, 'FILE_TOO_LARGE', 'The uploaded file exceeds the size limit');
    }
    return new AppError(400, 'UPLOAD_ERROR', err.message);
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
