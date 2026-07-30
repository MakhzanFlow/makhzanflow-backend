import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    phone: z.string().max(50).optional().nullable(),
    email: z.string().email('Invalid email').max(255).optional().nullable(),
    address: z.string().optional().nullable(),
    opening_balance: z.number().optional().default(0),
  }),
});

export const updateCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    phone: z.string().max(50).optional().nullable(),
    email: z.string().email('Invalid email').max(255).optional().nullable(),
    address: z.string().optional().nullable(),
  }),
});

export const listCustomersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    sort: z.enum(['name', 'created_at', 'opening_balance']).optional().default('name'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
    debt_status: z.enum(['all', 'has_debt', 'zero_debt', 'credit']).optional().default('all'),
  }),
});

export const debtorsListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
  }),
});

export const getCustomerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID'),
  }),
});

export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID'),
  }),
});

export const customerTransactionsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});
