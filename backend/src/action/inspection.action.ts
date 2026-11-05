import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai/gemini.service';
import { SiteInspectionAnalysisRequest, PhotoInspectionRequest } from '../services/ai/ai.interface';

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
 */
export function validatePhotoInspectionPayload(data: unknown): {
  valid: boolean;
  errors?: string[];
  value?: PhotoInspectionRequest;
} {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = data as Partial<PhotoInspectionRequest>;

  if (!payload.bankId || typeof payload.bankId !== 'string' || !payload.bankId.trim()) {
    errors.push('bankId is required and must be a non-empty string');
  }

  if (!payload.department || typeof payload.department !== 'string' || !payload.department.trim()) {
    errors.push('department is required and must be a non-empty string');
  }

  if (!Array.isArray(payload.photos) || payload.photos.length === 0) {
    errors.push('photos is required and must contain at least one photograph');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      bankId: payload.bankId!.trim(),
      department: payload.department!.trim(),
      trafficSubtype: payload.trafficSubtype,
      selectedRiskBanks: payload.selectedRiskBanks,
      photos: payload.photos || [],
      siteNotes: payload.siteNotes?.trim(),
      inspectorName: payload.inspectorName?.trim(),
      jobReference: payload.jobReference?.trim(),
    },
  };
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
 * Analyzes uploaded site photographs against official question banks.
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

