import { injectable, inject } from "tsyringe";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant.middleware.js";
import { PaymentService } from "./payments.service.js";

@injectable()
export class PaymentController {
  constructor(@inject(PaymentService) private paymentService: PaymentService) {
    this.list = this.list.bind(this);
  }

  async list(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const result = await this.paymentService.list({
        companyId: req.companyId!,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        ...(req.query.search ? { search: String(req.query.search) } : {}),
        ...(req.query.start_date ? { start_date: String(req.query.start_date) } : {}),
        ...(req.query.end_date ? { end_date: String(req.query.end_date) } : {}),
        ...(req.query.sort ? { sort: String(req.query.sort) } : {}),
        ...(req.query.order ? { order: String(req.query.order) as "asc" | "desc" } : {}),
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
