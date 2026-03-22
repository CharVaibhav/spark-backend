import { RequestHandler } from 'express';
import { z, ZodSchema } from 'zod';

/** Middleware factory — validates req.body against a Zod schema */
export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    req.body = result.data; // replace with coerced/parsed data
    next();
  };
}
