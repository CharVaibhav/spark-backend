import { RequestHandler } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as userService from '../services/user.service.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Expects { idToken: string } from frontend Google Sign-in
 */
export const googleLogin: RequestHandler = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw new AppError(400, 'idToken is required');

  // Verify token with Google
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID, // Frontend Client ID
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new AppError(401, 'Invalid Google Token');
  }

  const email = payload.email;
  const name = payload.name || 'User';

  // Find or Create user natively
  let user = await userService.getUserByEmail(email);
  if (!user) {
    user = await userService.createUser({ email, name });
  }

  // Issue our own system JWT
  const authToken = jwt.sign(
    { sub: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: '7d' } // Auth token valid for 7 days
  );

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        available_credits: user.available_credits // Added to users types
      },
      token: authToken,
    },
  });
});
