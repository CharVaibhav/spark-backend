import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { googleLogin } from '../controllers/auth.controller.js';

const router = Router();

router.post(
  '/google',
  validate(z.object({ idToken: z.string().min(1) })),
  googleLogin
);

export default router;
