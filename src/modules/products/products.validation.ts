import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(255),
    sku: z.string().max(100).optional().nullable(),
    barcode: z.string().max(100).optional().nullable(),
    price: z.number().min(0, "Price must be >= 0"),
    cost: z.number().min(0).optional().default(0),
    stock: z.number().int().min(0).optional().default(0),
    min_stock: z.number().int().min(0).optional().default(0),
    expiry_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD")
      .optional()
      .nullable(),
    is_active: z.boolean().optional().default(true),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(255).optional(),
    sku: z.string().max(100).optional().nullable(),
    barcode: z.string().max(100).optional().nullable(),
    price: z.number().min(0, "Price must be >= 0").optional(),
    cost: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    min_stock: z.number().int().min(0).optional(),
    expiry_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD")
      .optional()
      .nullable(),
    is_active: z.boolean().optional(),
  }),
});

export const listProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    sort: z
      .enum(["name", "price", "stock", "created_at", "expiry_date"])
      .optional()
      .default("name"),
    order: z.enum(["asc", "desc"]).optional().default("asc"),
    low_stock: z.coerce.boolean().optional(),
    expiry_before: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    expiry_after: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    is_active: z.coerce.boolean().optional(),
  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID"),
  }),
});
