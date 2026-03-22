import { RequestHandler } from 'express';
import * as sparkService from '../services/spark.service.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

/** GET /api/blueprint/history — list all runs for the current user */
export const getHistory: RequestHandler = asyncHandler(async (req, res) => {
  const runs = await sparkService.getRunsByUser(req.userId!);
  res.json({ success: true, data: runs });
});

/** GET /api/blueprint/:runId — get a single run with full data */
export const getBlueprint: RequestHandler = asyncHandler(async (req, res) => {
  const run = await sparkService.getRun(req.params.runId);
  if (!run) throw new AppError(404, 'Blueprint not found');
  if (run.user_id !== req.userId) throw new AppError(403, 'Forbidden');
  res.json({ success: true, data: run });
});

/** GET /api/blueprint/:runId/status — lightweight status check (no full payload) */
export const getStatus: RequestHandler = asyncHandler(async (req, res) => {
  const run = await sparkService.getRun(req.params.runId);
  if (!run) throw new AppError(404, 'Not found');
  if (run.user_id !== req.userId) throw new AppError(403, 'Forbidden');
  res.json({ success: true, data: { runId: run.run_id, status: run.status } });
});

/** DELETE /api/blueprint/:runId — delete a run */
export const deleteBlueprint: RequestHandler = asyncHandler(async (req, res) => {
  const deleted = await sparkService.deleteRun(req.params.runId, req.userId!);
  if (!deleted) throw new AppError(404, 'Not found or not owned by you');
  res.json({ success: true });
});
