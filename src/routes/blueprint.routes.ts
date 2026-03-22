import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getHistory, getBlueprint, getStatus, deleteBlueprint } from '../controllers/blueprint.controller.js';

const router = Router();

// All blueprint routes require auth
router.use(authMiddleware);

router.get('/history', getHistory);
router.get('/:runId/status', getStatus);
router.get('/:runId', getBlueprint);
router.delete('/:runId', deleteBlueprint);

export default router;
