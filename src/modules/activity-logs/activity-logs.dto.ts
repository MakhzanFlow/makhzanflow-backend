export interface ActivityLogResponse {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string | undefined;
  entity: string;
  entity_id: string;
  action: string;
  changes: Record<string, any> | null;
  created_at: Date;
}
