import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware.js';
import { AppError } from '../shared/errors/app-error.js';
import { prisma } from '../database/prisma.js';

export interface TenantRequest extends AuthRequest {
  companyId?: string;
  role?: string;
  permissions?: Record<string, any>;
}

export const scopeTenant = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant check
    // 1. Check if authenticated user exists
    if (!req.user?.id) {
      return next(new AppError(401, 'Authentication required', 'errors.authenticationRequired'));
    }

    // 2. Extract company ID from request header or user payload
    const companyId = (req.headers['x-company-id'] as string) || req.user.companyId;
    if (!companyId) {
      return next(new AppError(400, 'Company scope is required', 'errors.companyScopeRequired'));
    }

    // 3. Verify the user is a member of the requested company
    const member = await prisma.company_members.findUnique({
      where: { company_id_user_id: { company_id: companyId, user_id: req.user.id } },
      select: { role: true, permissions: true },
    });

    if (!member) {
      return next(new AppError(403, 'You are not a member of this company', 'errors.notCompanyMember'));
    }

    // 4. Attach tenant information to request (role from membership, never from token)
    req.companyId = companyId;
    req.role = member.role;
    req.permissions = member.permissions as Record<string, any>;

    next();
  } catch (error) {
    next(error);
  }
};
