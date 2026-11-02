import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export type ValidatorFn<T> = (data: unknown) => { valid: boolean; errors?: string[]; value?: T };

/**
 * Validates request body using a validator function.
 */
export function validateBody<T>(validator: ValidatorFn<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.body);
    if (!result.valid) {
      return next(new AppError('Invalid request body', 400, result.errors));
    }
    req.body = result.value ?? req.body;
    next();
  };
}

/**
 * Validates request query using a validator function.
 */
export function validateQuery<T>(validator: ValidatorFn<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.query);
    if (!result.valid) {
      return next(new AppError('Invalid query parameters', 400, result.errors));
    }
    next();
  };
}

