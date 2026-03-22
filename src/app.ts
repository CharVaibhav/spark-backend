import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { mountRoutes } from './routes/index.js';

const app = express();

// ─── Security & Performance Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10kb' }));

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
app.use(apiLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
mountRoutes(app);

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

export default app;
