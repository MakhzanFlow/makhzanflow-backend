import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../shared/errors/app-error.js';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const zErr = error as ZodError;
        const errors = zErr.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(new AppError(400, 'Validation failed', 'errors.validation', errors));
      }
      return next(error);
    }
  };
};
