import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai/gemini.service';

/**
 * AI Service status action handler.
 * Queries current readiness status of the AI service interface.
 * Responds to: GET /api/ai/status
 */
export async function getAiStatusAction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
}

