import { injectable, inject } from "tsyringe";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant.middleware.js";
import { DashboardService } from "./dashboard.service.js";

@injectable()
export class DashboardController {
  constructor(@inject(DashboardService) private dashboardService: DashboardService) {
    this.getStats = this.getStats.bind(this);
    this.getLowStock = this.getLowStock.bind(this);
    this.getMonthlyReport = this.getMonthlyReport.bind(this);
    this.getActivity = this.getActivity.bind(this);
  }

  async getStats(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const stats = await this.dashboardService.getStats(req.companyId!);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLowStock(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const result = await this.dashboardService.getLowStock({
        companyId: req.companyId!,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        ...(req.query.search ? { search: String(req.query.search) } : {}),
        ...(req.query.sort ? { sort: String(req.query.sort) } : {}),
        ...(req.query.order ? { order: String(req.query.order) } : {}),
      });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMonthlyReport(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const months = Number(req.query.months) || 12;
      const result = await this.dashboardService.getMonthlyReport({
        companyId: req.companyId!,
        months,
        ...(req.query.from ? { from: String(req.query.from) } : {}),
        ...(req.query.to ? { to: String(req.query.to) } : {}),
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getActivity(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const result = await this.dashboardService.getActivity({
        companyId: req.companyId!,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
