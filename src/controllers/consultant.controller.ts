import { RequestHandler } from 'express';
import { z } from 'zod';
import * as consultantService from '../services/consultant.service.js';
import * as redisService from '../services/redis.service.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { initSSE, sendSSEEvent, sendSSEError } from '../utils/sse.js';

/** POST /api/consultant/review */
export const requestReview: RequestHandler = asyncHandler(async (req, res) => {
  const { ideaContext } = req.body;
  if (!ideaContext) throw new AppError(400, "ideaContext is required");

  const reviewId = await consultantService.initiateConsultantReview(req.userId!, ideaContext);
  res.status(202).json({ success: true, data: { reviewId } });
});

/** GET /api/consultant/events/:reviewId - Live SSE Stream */
export const streamReviewEvents: RequestHandler = async (req, res) => {
  const { reviewId } = req.params;

  initSSE(res);

  const unsubscribe = await redisService.subscribeToResult(
    reviewId,
    (chunk) => sendSSEEvent(res, 'chunk', { chunk }),
    (event) => {
      sendSSEEvent(res, event.type, event.data ?? event);
      if (['consultant_ready', 'error'].includes(event.type)) {
        unsubscribe();
        res.end();
      }
    },
    (err) => {
      sendSSEError(res, err.message);
      unsubscribe();
    }
  );

  req.on('close', () => unsubscribe());
};

/** GET /api/consultant/reviews */
export const listReviews: RequestHandler = asyncHandler(async (req, res) => {
  const reviews = await consultantService.getConsultantReviewsByUser(req.userId!);
  res.json({ success: true, data: reviews });
});

/** GET /api/consultant/reviews/:reviewId */
export const getReview: RequestHandler = asyncHandler(async (req, res) => {
  const review = await consultantService.getConsultantReview(req.params.reviewId, req.userId!);
  if (!review) throw new AppError(404, "Review not found");
  
  // Parse JSON gracefully
  const parsed = {
    ...review,
    review_json: typeof review.review_json === 'string' ? JSON.parse(review.review_json) : null
  };
  
  res.json({ success: true, data: parsed });
});
