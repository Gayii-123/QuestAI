import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 404 Route Not Found middleware
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
      statusCode: 404,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Centralized error-handling middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  let statusCode = isAppError ? err.statusCode : 500;
  let errorCode = isAppError ? 'APPLICATION_ERROR' : 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred.';

  // Handle common Express / body-parser errors
  if ('type' in err && (err as { type: string }).type === 'entity.too.large') {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = `Request payload exceeds allowed limit of ${env.MAX_REQUEST_SIZE}.`;
  } else if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Malformed JSON payload provided.';
  }

  // Log error summary on server without exposing raw request bodies or secrets
  if (statusCode >= 500) {
    console.error(`[Error ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  } else {
    console.warn(`[Warning ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(isAppError && err.details ? { details: err.details } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}

