import { injectable, inject } from "tsyringe";
import { ActivityLogRepository } from "./activity-logs.repository.js";
import type { CreateLogInput, LogEntry, ListLogParams } from "./activity-logs.types.js";
import type { ActivityLogResponse } from "./activity-logs.dto.js";
import type { PaginatedResponse } from "../../shared/types/shared.dto.js";

@injectable()
export class ActivityLogService {
  constructor(
    @inject(ActivityLogRepository) private activityLogRepository: ActivityLogRepository
  ) {}

  async log(data: CreateLogInput): Promise<LogEntry> {
    return this.activityLogRepository.create(data);
  }

  async getLogs(params: ListLogParams): Promise<PaginatedResponse<ActivityLogResponse>> {
    const { companyId, entity, entityId, page, limit } = params;
    const skip = (page - 1) * limit;

    const { logs, total } = await this.activityLogRepository.findByEntity(
      companyId,
      entity,
      entityId,
      skip,
      limit
    );

    return {
      data: logs.map((log) => ({
        id: log.id,
        company_id: log.company_id,
        user_id: log.user_id,
        user_name: log.user_name,
        entity: log.entity,
        entity_id: log.entity_id,
        action: log.action,
        changes: log.changes,
        created_at: log.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
