import rateLimit from 'express-rate-limit';

const rateLimitHandler = (_req: any, res: any) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests',
    retryAfter: Math.ceil(res.getHeader('Retry-After') as number) || 60,
  });
};

/** General limiter — applied globally to all routes */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Spark limiter — for validate/blueprint (expensive AI calls) */
export const sparkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Chat limiter — for chat messages */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
