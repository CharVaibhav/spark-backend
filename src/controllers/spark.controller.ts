import { RequestHandler } from 'express';
import * as sparkService from '../services/spark.service.js';
import * as redisService from '../services/redis.service.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { initSSE, sendSSEEvent, sendSSEError } from '../utils/sse.js';
import { ValidateIdeaRequest, GenerateBlueprintRequest } from '../types/api.types.js';

/** POST /api/spark/validate — kick off idea validation */
export const validateIdea: RequestHandler = asyncHandler(async (req, res) => {
  const { idea } = req.body as ValidateIdeaRequest;
  const runId = await sparkService.initiateValidation(req.userId!, idea);
  // Return immediately — client subscribes to /events/:runId for the result
  res.status(202).json({ success: true, data: { runId } });
});

/** POST /api/spark/blueprint — kick off blueprint generation */
export const generateBlueprint: RequestHandler = asyncHandler(async (req, res) => {
  const { runId } = req.body as GenerateBlueprintRequest;
  await sparkService.initiateBlueprint(runId, req.userId!);
  res.status(202).json({ success: true, data: { runId } });
});

/** GET /api/spark/events/:runId — SSE stream for live results */
export const streamEvents: RequestHandler = async (req, res) => {
  const { runId } = req.params;

  initSSE(res);

  const unsubscribe = await redisService.subscribeToResult(
    runId,
    (chunk) => sendSSEEvent(res, 'chunk', { chunk }),
    (event) => {
      sendSSEEvent(res, event.type, event.data ?? event);
      // Close the SSE stream once a terminal event arrives
      if (['strategy_ready', 'blueprint_ready', 'error'].includes(event.type)) {
        unsubscribe();
        res.end();
      }
    },
    (err) => {
      sendSSEError(res, err.message);
      unsubscribe();
    }
  );

  // Client disconnects early → cleanup
  req.on('close', () => unsubscribe());
};
