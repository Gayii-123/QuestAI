import { Router } from 'express';
import { validateBody } from '../middleware/validation';
import {
  getAiStatusAction,
  runInspectionAction,
  validateInspectionPayload,
  runPhotoInspectionAction,
  validatePhotoInspectionPayload,
} from '../action';

export const aiRouter = Router();

/**
 * GET /api/ai/status
 * Delegates to centralized action handler.
 */
aiRouter.get('/status', getAiStatusAction);

/**
 * POST /api/ai/inspect
 * Validates request payload and delegates to centralized action handler.
 */
aiRouter.post(
  '/inspect',
  validateBody(validateInspectionPayload),
  runInspectionAction
);

/**
 * POST /api/ai/inspect-photos
 * Multimodal inspection evaluation of site photographs.
 */
aiRouter.post(
  '/inspect-photos',
  validateBody(validatePhotoInspectionPayload),
  runPhotoInspectionAction
);
