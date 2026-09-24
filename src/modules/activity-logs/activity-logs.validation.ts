import { z } from "zod";

const ENTITY_PERMISSIONS = ["products.read", "invoices.read", "customers.read"] as const;

export const activityLogParamsSchema = z.object({
  params: z.object({
    entity: z.enum(["product", "invoice", "customer"]),
    entityId: z.string().uuid("Invalid entity ID"),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export function permissionForEntity(entity: string): string {
  switch (entity) {
    case "invoice":
      return "invoices.read";
    case "customer":
      return "customers.read";
    case "product":
    default:
      return "products.read";
  }
}

export { ENTITY_PERMISSIONS };
