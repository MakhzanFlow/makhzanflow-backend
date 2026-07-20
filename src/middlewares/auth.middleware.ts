import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../errors/app-error.js';

export interface AuthRequest extends Request {
  user?: any; // Replace with User type when available
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(401, 'Unauthorized', 'errors.unauthorized'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError(401, 'Unauthorized', 'errors.unauthorized'));
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    
    next();
  } catch (error) {
    return next(new AppError(401, 'Invalid or expired token', 'errors.invalid_token'));
  }
};
