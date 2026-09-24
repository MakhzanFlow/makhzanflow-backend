import type { Response, NextFunction } from "express";
import type { TenantRequest } from "./tenant.middleware.js";
import { AppError } from "../shared/errors/app-error.js";
import { permissionForEntity } from "../modules/activity-logs/activity-logs.validation.js";
import { authorize } from "./authorize.middleware.js";

/** Entity-aware authorization for activity logs: invoice→invoices.read, customer→customers.read, product→products.read. */
export function authorizeActivityLog() {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    const entity = req.params.entity as string;
    if (entity !== "product" && entity !== "invoice" && entity !== "customer") {
      return next(new AppError(400, "Invalid entity", "errors.validation"));
    }
    return authorize(permissionForEntity(entity))(req, res, next);
  };
}
