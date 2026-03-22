import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sparkLimiter } from '../middleware/rateLimiter.js';
import { requestReview, streamReviewEvents, listReviews, getReview } from '../controllers/consultant.controller.js';

const router = Router();

// Consultant requires auth
router.use(authMiddleware);

// Trigger new review
router.post(
  '/review',
  sparkLimiter,
  validate(z.object({ ideaContext: z.string().min(10) })),
  requestReview
);

// Stream realtime results
router.get('/events/:reviewId', streamReviewEvents);

// History
router.get('/reviews', listReviews);
router.get('/reviews/:reviewId', getReview);

export default router;
