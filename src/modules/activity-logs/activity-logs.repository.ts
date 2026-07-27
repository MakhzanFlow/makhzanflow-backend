import { injectable } from "tsyringe";
import { prisma } from "../../database/prisma.js";
import type { CreateLogInput, LogEntry } from "./activity-logs.types.js";
import type { Prisma } from "../../../generated/prisma/client.js";

@injectable()
export class ActivityLogRepository {
  async create(data: CreateLogInput): Promise<LogEntry> {
    const log = await prisma.activity_logs.create({
      data: {
        company_id: data.company_id,
        user_id: data.user_id,
        entity: data.entity,
        entity_id: data.entity_id,
        action: data.action,
        ...(data.changes !== undefined && data.changes !== null
          ? { changes: data.changes as Prisma.InputJsonValue }
          : {}),
      },
    });
    return this.mapToLogEntry(log);
  }

  async findByEntity(
    companyId: string,
    entity: string,
    entityId: string,
    skip: number,
    take: number
  ): Promise<{ logs: LogEntry[]; total: number }> {
    const where = {
      company_id: companyId,
      entity,
      entity_id: entityId,
    };

    const [logs, total] = await Promise.all([
      prisma.activity_logs.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: "desc" },
        include: { users: { select: { name: true } } },
      }),
      prisma.activity_logs.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        ...this.mapToLogEntry(log),
        user_name: log.users.name,
      })),
      total,
    };
  }

  private mapToLogEntry(log: any): LogEntry {
    return {
      id: log.id,
      company_id: log.company_id,
      user_id: log.user_id,
      entity: log.entity,
      entity_id: log.entity_id ?? "",
      action: log.action,
      changes: log.changes as Record<string, any> | null,
      created_at: log.created_at,
    };
  }
}
