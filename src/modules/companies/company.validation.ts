import { z } from 'zod';

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
    permissions: z.record(z.string(), z.any()).optional(),
  }),
});

export const updateMemberSchema = z.object({
  body: z.object({
    role: z.enum(['owner', 'admin', 'member']).optional(),
    permissions: z.record(z.string(), z.any()).optional(),
  }),
});
