import { injectable, inject } from "tsyringe";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant.middleware.js";
import { InvoiceService } from "./invoices.service.js";
import type { TFunction } from "i18next";
import type { ListInvoicesParams } from "../../types/invoices.js";

@injectable()
export class InvoiceController {
  constructor(@inject(InvoiceService) private invoiceService: InvoiceService) {
    this.create = this.create.bind(this);
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.addPayment = this.addPayment.bind(this);
    this.cancel = this.cancel.bind(this);
  }

  async create(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const invoice = await this.invoiceService.create(
        {
          ...req.body,
          company_id: req.companyId!,
        },
        req.user?.id ?? ""
      );
      const t = req.t as TFunction;
      res.status(201).json({
        success: true,
        message: t ? t("invoices:created") : "Invoice created successfully",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const q = req.query;
      const params: ListInvoicesParams = {
        companyId: req.companyId!,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 20,
      };
      if (q.search) params.search = String(q.search);
      if (q.status) params.status = q.status as ListInvoicesParams["status"];
      if (q.customer_id) params.customer_id = String(q.customer_id);
      if (q.start_date) params.start_date = String(q.start_date);
      if (q.end_date) params.end_date = String(q.end_date);
      if (q.sort) params.sort = String(q.sort);
      if (q.order) params.order = q.order as ListInvoicesParams["order"];

      const result = await this.invoiceService.list(params);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invoice = await this.invoiceService.findById(id, req.companyId!);
      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  async addPayment(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invoice = await this.invoiceService.addPayment(id, req.companyId!, req.body, req.user?.id ?? "");
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t("invoices:paymentAdded") : "Payment added successfully",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const invoice = await this.invoiceService.cancel(id, req.companyId!, req.user?.id ?? "");
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t("invoices:canceled") : "Invoice canceled successfully",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
}
