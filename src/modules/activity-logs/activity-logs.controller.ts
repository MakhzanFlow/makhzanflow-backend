import { injectable, inject } from "tsyringe";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant.middleware.js";
import { ActivityLogService } from "./activity-logs.service.js";

@injectable()
export class ActivityLogController {
  constructor(@inject(ActivityLogService) private activityLogService: ActivityLogService) {}

  async getByEntity(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity as string;
      const entityId = req.params.entityId as string;
      const result = await this.activityLogService.getLogs({
        companyId: req.companyId!,
        entity,
        entityId,
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
