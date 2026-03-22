import { Application } from 'express';
import userRoutes from './user.routes.js';
import sparkRoutes from './spark.routes.js';
import blueprintRoutes from './blueprint.routes.js';
import chatRoutes from './chat.routes.js';
import authRoutes from './auth.routes.js';
import consultantRoutes from './consultant.routes.js';

export function mountRoutes(app: Application): void {
  // Health check — no auth
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/spark', sparkRoutes);
  app.use('/api/blueprint', blueprintRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/consultant', consultantRoutes);
}
