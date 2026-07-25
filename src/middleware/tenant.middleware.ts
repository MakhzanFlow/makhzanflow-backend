import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware.js';
import { AppError } from '../shared/errors/app-error.js';

export interface TenantRequest extends AuthRequest {
  companyId?: string;
  role?: string;
}

export const scopeTenant = (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant check
    // 1. Check if authenticated user exists
    if (!req.user) {
      return next(new AppError(401, 'Authentication required', 'errors.authenticationRequired'));
    }

    // 2. Extract company ID from request header or user payload
    const companyId = req.headers['x-company-id'] as string || req.user.companyId;
    if (!companyId) {
      return next(new AppError(400, 'Company scope is required', 'errors.companyScopeRequired'));
    }

    // 3. Attach tenant information to request
    req.companyId = companyId;
    req.role = req.user.role || 'Member'; // Default role if not present

    next();
  } catch (error) {
    next(error);
  }
};
