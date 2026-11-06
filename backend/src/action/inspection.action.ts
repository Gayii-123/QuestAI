import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai/gemini.service';
import { SiteInspectionAnalysisRequest, PhotoInspectionRequest } from '../services/ai/ai.interface';
import {
  validatePhotoInspectionRequest,
  PhotoValidationOptions,
} from '../services/ai/photo-inspection.validator';

/**
 * Validation function for site inspection requests.
 */
export function validateInspectionPayload(data: unknown): {
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
 * Validation function for photo inspection requests.
 * Validates bankId against official Quest banks, question IDs against the bank schema,
 * and uploaded photographs against binary magic-byte and size constraints.
 */
export function validatePhotoInspectionPayload(
  data: unknown,
  options?: PhotoValidationOptions
): {
  valid: boolean;
  errors?: string[];
  value?: PhotoInspectionRequest;
} {
  const result = validatePhotoInspectionRequest(data, options);
  if (!result.valid) {
    return { valid: false, errors: result.errors };
  }
  return { valid: true, value: result.value };
}

/**
 * Site inspection analysis action handler.
 * Analyzes site inspection request payload using the AI service.
 * Responds to: POST /api/ai/inspect
 */
export async function runInspectionAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

/**
 * Multimodal Photo Inspection action handler.
 * Analyzes uploaded site photographs against official Quest question banks using Gemini.
 * Responds to: POST /api/ai/inspect-photos
 */
export async function runPhotoInspectionAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await aiService.analyzeInspectionPhotos(req.body);
    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
