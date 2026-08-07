import type { Response, NextFunction } from 'express';
import type { TenantRequest } from './tenant.middleware.js';
import { AppError } from '../shared/errors/app-error.js';
import { prisma } from '../database/prisma.js';



async function resolveMemberPermissions(userId: string, companyId: string) {


  const member = await prisma.company_members.findUnique({
    where: { company_id_user_id: { company_id: companyId, user_id: userId } },
    select: { role: true, permissions: true },
  });

  if (!member) return null;

  const result = {
    role: member.role,
    permissions: member.permissions as Record<string, any>,
  };


  return result;
}

export function authorize(...requiredPermissions: string[]) {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return next(new AppError(401, 'Authentication required', 'errors.authenticationRequired'));
      }

      const companyId = req.companyId;
      if (!companyId) {
        return next(new AppError(400, 'Company scope required', 'errors.companyScopeRequired'));
      }

      // Reuse data from scopeTenant if already resolved
      let role = req.role;
      let permissions = req.permissions;

      if (!role || permissions === undefined) {
        const member = await resolveMemberPermissions(req.user.id, companyId);
        if (!member) {
          return next(new AppError(403, 'You are not a member of this company', 'errors.notCompanyMember'));
        }
        role = member.role;
        permissions = member.permissions;
      }

      req.role = role;

      if (role === 'owner' || role === 'admin') {
        return next();
      }

      const memberPerms = permissions ?? {};
      const hasAll = memberPerms.all === true;

      if (hasAll) {
        return next();
      }

      for (const perm of requiredPermissions) {
        const parts = perm.split('.');
        let value: any = memberPerms;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined || value === null) {
            return next(new AppError(403, 'You do not have permission to perform this action', 'errors.forbidden'));
          }
        }
        if (value !== true) {
          return next(new AppError(403, 'You do not have permission to perform this action', 'errors.forbidden'));
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
