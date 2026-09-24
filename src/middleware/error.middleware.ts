import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import type { TFunction } from 'i18next';

function scrubMeta(value: unknown): unknown {
  try {
    const raw = JSON.parse(JSON.stringify(value, (_k, v) => v)) as any;
    const scrub = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (/password|token|secret|authorization|invite|code/i.test(key)) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          scrub(obj[key]);
        }
      }
    };
    scrub(raw);
    return raw;
  } catch {
    return '[unserializable]';
  }
}

function resolveMessage(t: TFunction | undefined, messageKey: string | undefined, fallback: string): string {
  if (!messageKey || !t) return fallback;
  const candidates = [messageKey, `errors.${messageKey.split('.').pop()}`, `auth:${messageKey}`, `products:${messageKey}`];
  for (const key of candidates) {
    try {
      const translated = (t as any)(key);
      if (translated && translated !== key) return translated;
    } catch {
      // ignore
    }
  }
  return fallback;
}

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error caught by errorHandler:', scrubMeta({ message: err?.message, code: err?.code, statusCode: err?.statusCode }));

  const t = req.t as TFunction;

  if (err instanceof AppError) {
    const message = resolveMessage(t, err.messageKey, err.message);
    return res.status(err.statusCode).json({
      success: false,
      message,
      errors: err.errors || [],
    });
  }

  if (err?.name === 'MulterError') {
    const message = resolveMessage(t, 'errors.invalidFileType', err.message || 'File upload failed');
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, message, errors: [] });
  }

  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      message: resolveMessage(t, 'errors.validation', 'Invalid JSON body'),
      errors: [],
    });
  }

  if (err?.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: resolveMessage(t, 'errors.duplicate', 'Duplicate record'),
        errors: [],
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: resolveMessage(t, 'errors.notFound', 'Record not found'),
        errors: [],
      });
    }
  }

  const body: any = {
    success: false,
    message: t ? resolveMessage(t, 'errors.unexpected', 'Internal Server Error') : 'Internal Server Error',
    errors: [],
  };
  if (env.NODE_ENV !== 'production' && err?.message) {
    body.details = err.message;
  }
  return res.status(500).json(body);
};
