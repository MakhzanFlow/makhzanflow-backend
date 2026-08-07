import { member_role } from "../../../generated/prisma/client.js";

export interface CompanyResponse {
  id: string;
  name: string;
  logo_url: string | null;
  invite_code: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface CompanyWithSubscription extends CompanyResponse {
  company_subscriptions: Array<{
    id: string;
    subscription_plans: {
      id: string;
      name: string;
      price: number;
      duration_days: number;
    } | null;
    starts_at: Date;
    ends_at: Date;
  }> | null;
}

export interface CompanyMemberUser {
  id: string;
  name: string;
  email: string;
  is_verified: boolean;
}

export interface CompanyMemberResponse {
  id: string;
  company_id: string;
  user_id: string;
  role: member_role;
  permissions: Record<string, any> | any;
  created_at: Date | null;
  updated_at: Date | null;
  users?: CompanyMemberUser;
}

export interface UserCompanyResponse {
  id: string;
  name: string;
  logo_url: string | null;
  invite_code: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  company_members: Array<{
    role: member_role;
    permissions: Record<string, any> | any;
  }>;
}

export interface PermissionDescriptor {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroupDescriptor {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDescriptor[];
}

export interface PermissionCatalogResponse {
  groups: PermissionGroupDescriptor[];
}

export interface MemberPermissionsResponse {
  role: member_role;
  permissions: string[];
}
