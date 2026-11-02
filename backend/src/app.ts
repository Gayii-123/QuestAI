import express, { Application } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { apiRouter } from './routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

/**
 * Creates and configures the Express application.
 */
export function createApp(): Application {
  const app = express();

  // CORS configuration using explicit frontend origin for local development
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request body parsing with strict size limits
  app.use(express.json({ limit: env.MAX_REQUEST_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: env.MAX_REQUEST_SIZE }));

  // Root welcome / metadata route
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'QuestAI API',
      description: 'AI-Powered Site Inspection Service',
      version: '1.0.0',
      healthCheck: '/api/health',
      docs: '/api/ai/status',
    });
  });

  // Mount API routes under /api
  app.use('/api', apiRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

