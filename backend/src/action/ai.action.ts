import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai/gemini.service';

/**
 * AI Service status action handler.
 * Reports configuration, SDK initialisation and (cached) real-connection verification.
 * Plain calls never trigger a Gemini request; add ?verify=true to run a controlled
 * verification (still rate-limited by a cache expiry).
 * Responds to: GET /api/ai/status
 */
export async function getAiStatusAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const forceVerify = String(req.query.verify || '').toLowerCase() === 'true';
    const status = await aiService.getStatus({ forceVerify });
    res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Plain text generation through the real Gemini model.
 * Responds to: POST /api/ai/generate  { "prompt": "..." }
 */
export async function generateTextAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await aiService.generateText(req.body.prompt);
    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export function validateGeneratePayload(data: unknown): {
  valid: boolean;
  errors?: string[];
  value?: { prompt: string };
} {
  const prompt = (data as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { valid: false, errors: ['prompt is required and must be a non-empty string'] };
  }
  if (prompt.length > 8000) {
    return { valid: false, errors: ['prompt must be 8000 characters or fewer'] };
  }
  return { valid: true, value: { prompt: prompt.trim() } };
}
