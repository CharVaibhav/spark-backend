import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sparkLimiter } from '../middleware/rateLimiter.js';
import { validateIdea, generateBlueprint, streamEvents } from '../controllers/spark.controller.js';

const router = Router();

// POST /api/spark/validate — kick off idea validation
router.post(
  '/validate',
  authMiddleware,
  sparkLimiter,
  validate(z.object({ idea: z.string().min(10).max(500) })),
  validateIdea
);

// POST /api/spark/blueprint — kick off blueprint generation
router.post(
  '/blueprint',
  authMiddleware,
  sparkLimiter,
  validate(z.object({ runId: z.string().min(1) })),
  generateBlueprint
);

// GET /api/spark/events/:runId — SSE stream
router.get('/events/:runId', authMiddleware, streamEvents);

export default router;
