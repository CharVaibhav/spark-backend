import { ErrorRequestHandler, RequestHandler } from 'express';
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

/** Custom error class for intentional HTTP errors */
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/** Global error handler — must be registered last in Express middleware chain */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal server error';

  logger.error('Request error', {
    method: req.method,
    path: req.path,
    statusCode,
    message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/** Wrap async route handlers to forward errors to errorHandler */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
