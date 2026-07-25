import { z } from 'zod';
import { allPermissionKeys } from '../../shared/constants/permissions.js';

const allPerms = allPermissionKeys() as [string, ...string[]];

const permissionSelectionSchema = z.array(z.enum(allPerms)).min(0);

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Company name must be at least 2 characters'),
    logo_url: z.string().optional(),
  }),
});

export const updateCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Company name must be at least 2 characters').optional(),
    logo_url: z.string().optional(),
  }),
});

export const addMemberSchema = z.object({
  body: z.object({
    targetUserId: z.string().uuid('Invalid user ID'),
    role: z.enum(['owner', 'admin', 'member']),
    permissions: permissionSelectionSchema.optional().default([]),
  }),
});

export const updateMemberSchema = z.object({
  body: z.object({
    role: z.enum(['owner', 'admin', 'member']).optional(),
    permissions: permissionSelectionSchema.optional(),
  }),
});
