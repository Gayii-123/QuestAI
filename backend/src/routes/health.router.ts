import { Router } from 'express';
import { getHealthAction } from '../action';

export const healthRouter = Router();

/**
 * GET /api/health
 * Delegates to centralized action handler.
 */
healthRouter.get('/', getHealthAction);
