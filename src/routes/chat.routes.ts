import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { createThread, sendMessage, streamChatEvents, getThreads } from '../controllers/chat.controller.js';

const router = Router();

// All chat routes require auth
router.use(authMiddleware);

router.post('/thread', validate(z.object({ runId: z.string().optional() })), createThread);

router.post(
  '/message',
  chatLimiter,
  validate(z.object({
    message: z.string().min(1).max(2000),
    threadId: z.string().min(1),
    runId: z.string().optional(),
  })),
  sendMessage
);

router.get('/events/:jobId', streamChatEvents);
router.get('/threads', getThreads);

export default router;
