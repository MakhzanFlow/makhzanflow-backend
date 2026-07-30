import { z } from "zod";

export const listInvoicesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    status: z.enum(["pending", "paid", "partially_paid", "canceled"]).optional(),
    customer_id: z.string().uuid("Invalid customer ID").optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD").optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD").optional(),
    sort: z.enum(["invoice_number", "total_amount", "created_at", "due_date"]).optional().default("created_at"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

export const invoiceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid invoice ID"),
  }),
});

export const createInvoiceSchema = z.object({
  body: z.object({
    customer_id: z.string().uuid("Invalid customer ID").optional().nullable(),
    discount_amount: z.number().min(0).optional().default(0),
    tax_amount: z.number().min(0).optional().default(0),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD").optional().nullable(),
    items: z.array(
      z.object({
        product_id: z.string().uuid("Invalid product ID"),
        quantity: z.number().int().positive("Quantity must be >= 1"),
        unit_price: z.number().min(0).optional(),
      })
    ).min(1, "Invoice must contain at least one item"),
    payment: z.object({
      amount: z.number().min(0),
      method: z.enum(["cash", "card", "bank_transfer", "other"]),
      reference_number: z.string().max(100).optional().nullable(),
      notes: z.string().optional().nullable(),
    }).optional(),
  }),
});

export const addPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive("Payment amount must be greater than 0"),
    method: z.enum(["cash", "card", "bank_transfer", "other"]),
    reference_number: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});
