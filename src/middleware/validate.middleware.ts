import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../shared/errors/app-error.js';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed && typeof parsed === 'object') {
        if ((parsed as any).body !== undefined) req.body = (parsed as any).body;
        if ((parsed as any).query !== undefined) req.query = (parsed as any).query;
        if ((parsed as any).params !== undefined) req.params = (parsed as any).params;
      }
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
