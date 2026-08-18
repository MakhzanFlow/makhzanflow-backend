import { z } from "zod";

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    type: z.enum(["received", "made"]).optional(),
    search: z.string().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD").optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD").optional(),
    sort: z.enum(["created_at", "amount"]).optional().default("created_at"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});
