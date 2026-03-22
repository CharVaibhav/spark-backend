import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUser, getMe } from '../controllers/user.controller.js';

const router = Router();

router.post(
  '/',
  validate(z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    clerkId: z.string().optional(),
  })),
  createUser
);

router.get('/me', authMiddleware, getMe);

export default router;
