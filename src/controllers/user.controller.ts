import { RequestHandler } from 'express';
import * as userService from '../services/user.service.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { CreateUserRequest } from '../types/api.types.js';

/** POST /api/user — create a new user */
export const createUser: RequestHandler = asyncHandler(async (req, res) => {
  const { email, name, clerkId } = req.body as CreateUserRequest;
  const user = await userService.createUser({ email, name, clerkId });
  res.status(201).json({ success: true, data: user });
});

/** GET /api/user/me — get the current authenticated user */
export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.userId!);
  if (!user) throw new AppError(404, 'User not found');
  res.json({ success: true, data: user });
});
