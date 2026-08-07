import { z } from "zod";

export const lowStockSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    sort: z.enum(["name", "price", "stock", "created_at"]).optional().default("name"),
    order: z.enum(["asc", "desc"]).optional().default("asc"),
  }),
});

export const monthlyReportSchema = z.object({
  query: z.object({
    months: z.coerce.number().int().min(1).max(24).optional().default(12),
    from: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Use YYYY-MM or YYYY-MM-DD").optional(),
    to: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Use YYYY-MM or YYYY-MM-DD").optional(),
  }),
});

export const activitySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});
