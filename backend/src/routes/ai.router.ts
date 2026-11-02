import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai/gemini.service';
import { validateBody } from '../middleware/validation';
import { SiteInspectionAnalysisRequest } from '../services/ai/ai.interface';

export const aiRouter = Router();

/**
 * Validation function for site inspection requests.
 */
function validateInspectionRequest(data: unknown): {
  valid: boolean;
  errors?: string[];
  value?: SiteInspectionAnalysisRequest;
} {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = data as Partial<SiteInspectionAnalysisRequest>;

  if (!payload.inspectionId || typeof payload.inspectionId !== 'string' || !payload.inspectionId.trim()) {
    errors.push('inspectionId is required and must be a non-empty string');
  }

  if (!payload.siteName || typeof payload.siteName !== 'string' || !payload.siteName.trim()) {
    errors.push('siteName is required and must be a non-empty string');
  }

  if (payload.imageUrls && !Array.isArray(payload.imageUrls)) {
    errors.push('imageUrls, if provided, must be an array of URL strings');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      inspectionId: payload.inspectionId!.trim(),
      siteName: payload.siteName!.trim(),
      notes: payload.notes?.trim(),
      imageUrls: payload.imageUrls,
      metadata: payload.metadata,
    },
  };
}

/**
 * GET /api/ai/status
 * Check the status and readiness of the AI inspection service.
 */
aiRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await aiService.getStatus();
    res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/inspect
 * Placeholder endpoint to trigger site inspection analysis.
 */
aiRouter.post(
  '/inspect',
  validateBody(validateInspectionRequest),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiService.analyzeInspection(req.body);
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

