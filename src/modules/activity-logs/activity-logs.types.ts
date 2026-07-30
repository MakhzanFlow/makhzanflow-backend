export interface CreateLogInput {
  company_id: string;
  user_id: string;
  entity: string;
  entity_id: string;
  action: "create" | "update" | "delete" | "cancel";
  changes?: Record<string, any> | null;
}

export interface LogEntry {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  entity: string;
  entity_id: string;
  action: string;
  changes: Record<string, any> | null;
  created_at: Date;
}

export interface ListLogParams {
  companyId: string;
  entity: string;
  entityId: string;
  page: number;
  limit: number;
}
