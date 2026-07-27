import { injectable, inject } from "tsyringe";
import { ActivityLogRepository } from "./activity-logs.repository.js";
import type { CreateLogInput, LogEntry, ListLogParams } from "./activity-logs.types.js";

@injectable()
export class ActivityLogService {
  constructor(
    @inject(ActivityLogRepository) private activityLogRepository: ActivityLogRepository
  ) {}

  async log(data: CreateLogInput): Promise<LogEntry> {
    return this.activityLogRepository.create(data);
  }

  async getLogs(params: ListLogParams) {
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
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
