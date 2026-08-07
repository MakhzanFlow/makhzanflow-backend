import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import { logger } from '../config/logger.js';
import type { TFunction } from 'i18next';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error caught by errorHandler:', err);

  const t = req.t as TFunction;

  if (err instanceof AppError) {
    let message = err.message;
    if (err.messageKey && t) {
      const key = `errors.${err.messageKey.split('.').pop()}`;
      const translated = t(key);
      if (translated && translated !== key) {
        message = translated;
      }
    }
    return res.status(err.statusCode).json({
      success: false,
      message,
      errors: err.errors || [],
    });
  }

  const message = t ? t('errors.unexpected') : 'Internal Server Error';
  return res.status(500).json({
    success: false,
    message,
    errors: [],
  });
};
