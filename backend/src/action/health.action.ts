import { Request, Response } from 'express';

/**
 * Health check action handler.
 * Returns service status, uptime, environment, and timestamp.
 * Responds to: GET /api/health
 */
export function getHealthAction(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    service: 'QuestAI API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
}

/**
 * Root metadata action handler.
 * Responds to: GET /
 */
export function getApiMetadataAction(req: Request, res: Response): void {
  res.status(200).json({
    name: 'QuestAI API',
    description: 'AI-Powered Site Inspection Service',
    version: '1.0.0',
    healthCheck: '/api/health',
    docs: '/api/ai/status',
  });
}

