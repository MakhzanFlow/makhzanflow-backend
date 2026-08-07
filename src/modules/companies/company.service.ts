import { injectable, inject } from 'tsyringe';
import crypto from 'crypto';
import { CompanyRepository } from './company.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { member_role } from '../../../generated/prisma/client.js';
import { COMPANY } from '../../shared/constants/index.js';
import { uploadImageBase64 } from '../../shared/utils/cloudinary.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import {
  PERMISSION_GROUPS,
  allPermissionKeys,
  buildPermissionObject,
  flattenPermissions,
} from '../../shared/constants/permissions.js';
import type {
  CompanyResponse,
  CompanyWithSubscription,
  CompanyMemberResponse,
  UserCompanyResponse,
  PermissionCatalogResponse,
  MemberPermissionsResponse,
} from './company.dto.js';
import type { PaginatedResponse } from '../../shared/types/shared.dto.js';

@injectable()
export class CompanyService {
  constructor(@inject(CompanyRepository) private companyRepository: CompanyRepository) {}

  private async resolveLogoUrl(logoUrl?: string | null): Promise<string | null> {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('data:')) {
      try {
        return await uploadImageBase64(logoUrl, env.CLOUDINARY_COMPANY_LOGOS_FOLDER);
      } catch (error) {
        logger.error('Logo upload to Cloudinary failed:', error);
        return null;
      }
    }
    return logoUrl;
  }

  private toCompanyResponse(company: { id: string; name: string; logo_url: string | null; invite_code: string | null; created_at: Date | null; updated_at: Date | null }) {
    return {
      id: company.id,
      name: company.name,
      logo_url: company.logo_url,
      invite_code: company.invite_code,
      created_at: company.created_at,
      updated_at: company.updated_at,
    };
  }

  private async generateInviteCode(): Promise<string> {
    let attempts = 0;
    do {
      let code = '';
      for (let i = 0; i < COMPANY.INVITE_CODE_LENGTH; i++) {
        code += COMPANY.INVITE_CODE_CHARS[crypto.randomInt(COMPANY.INVITE_CODE_CHARS.length)];
      }
      const existing = await this.companyRepository.findByInviteCode(code);
      if (!existing) return code;
      attempts++;
    } while (attempts < 10);
    throw new AppError(500, 'Failed to generate unique invite code', 'errors.inviteCodeGenerationFailed');
  }

  private async requireMember(companyId: string, userId: string) {
    const member = await this.companyRepository.findMember(companyId, userId);
    if (!member) {
      throw new AppError(403, 'You do not have access to this company', 'errors.forbidden');
    }
    return member;
  }

  private async requireOwnerOrAdmin(companyId: string, userId: string) {
    const member = await this.requireMember(companyId, userId);
    if (member.role !== member_role.owner && member.role !== member_role.admin) {
      throw new AppError(403, 'Only owners and admins can perform this action', 'errors.unauthorized');
    }
    return member;
  }

  private async requireOwner(companyId: string, userId: string) {
    const member = await this.requireMember(companyId, userId);
    if (member.role !== member_role.owner) {
      throw new AppError(403, 'Only the owner can perform this action', 'errors.unauthorized');
    }
    return member;
  }

  async createCompany(data: { name: string; logo_url?: string }, ownerUserId: string): Promise<CompanyResponse> {
    if (!data.name || data.name.trim() === '') {
      throw new AppError(400, 'Company name is required', 'errors.companyNameRequired');
    }

    const existing = await this.companyRepository.findByName(data.name);
    if (existing) {
      throw new AppError(409, 'A company with this name already exists', 'errors.companyExists');
    }

    const logoUrl = await this.resolveLogoUrl(data.logo_url);
    const inviteCode = await this.generateInviteCode();

    const company = await this.companyRepository.createCompanyWithOwner(
      { name: data.name, logo_url: logoUrl, invite_code: inviteCode },
      ownerUserId
    );

    return this.toCompanyResponse(company);
  }

  async getCompanyDetails(companyId: string, userId: string): Promise<CompanyWithSubscription> {
    const membership = await this.requireMember(companyId, userId);

    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new AppError(404, 'Company not found', 'errors.companyNotFound');
    }

    const isAdminOrOwner = membership.role === member_role.owner || membership.role === member_role.admin;

    return {
      id: company.id,
      name: company.name,
      logo_url: company.logo_url,
      invite_code: isAdminOrOwner ? company.invite_code : null,
      created_at: company.created_at,
      updated_at: company.updated_at,
      company_subscriptions: (company.company_subscriptions ?? []) as any,
    };
  }

  async updateCompany(companyId: string, data: { name?: string; logo_url?: string }, userId: string): Promise<CompanyResponse> {
    await this.requireOwnerOrAdmin(companyId, userId);

    const { logo_url, ...cleanData } = data;

    const company = await this.companyRepository.update(companyId, {
      ...cleanData,
      ...(logo_url !== undefined && { logo_url: await this.resolveLogoUrl(logo_url) }),
    });

    return this.toCompanyResponse(company);
  }

  async deleteCompany(companyId: string, userId: string): Promise<CompanyResponse> {
    await this.requireOwner(companyId, userId);

    const company = await this.companyRepository.delete(companyId);
    return this.toCompanyResponse(company);
  }

  async listMembers(companyId: string, userId: string, pagination: { page?: number; limit?: number }): Promise<PaginatedResponse<CompanyMemberResponse>> {
    await this.requireMember(companyId, userId);

    const result = await this.companyRepository.findMembers(companyId, pagination);
    return {
      data: result.data as any,
      pagination: result.pagination,
    };
  }

  async addMember(
    companyId: string,
    targetUserId: string,
    role: member_role,
    permissions: any = {},
    operatorUserId: string
  ): Promise<CompanyMemberResponse> {
    await this.requireOwnerOrAdmin(companyId, operatorUserId);

    const existingMember = await this.companyRepository.findMember(companyId, targetUserId);
    if (existingMember) {
      throw new AppError(400, 'User is already a member of this company', 'errors.alreadyMember');
    }

    const permObject = Array.isArray(permissions) ? buildPermissionObject(permissions) : permissions;
    const member = await this.companyRepository.addMember(companyId, targetUserId, role, permObject);
    return member as any;
  }

  async removeMember(companyId: string, targetUserId: string, operatorUserId: string): Promise<CompanyMemberResponse> {
    const operator = await this.requireOwnerOrAdmin(companyId, operatorUserId);

    const target = await this.companyRepository.findMember(companyId, targetUserId);
    if (!target) {
      throw new AppError(404, 'Member not found', 'errors.memberNotFound');
    }

    if (target.role === member_role.owner) {
      throw new AppError(400, 'The owner cannot be removed from the company', 'errors.cannotRemoveOwner');
    }

    if (operator.role === member_role.admin && target.role === member_role.admin) {
      throw new AppError(403, 'Admins cannot remove other admins', 'errors.unauthorized');
    }

    const removed = await this.companyRepository.removeMember(companyId, targetUserId);
    return removed as any;
  }

  async updateMember(
    companyId: string,
    targetUserId: string,
    data: { role?: member_role; permissions?: any },
    operatorUserId: string
  ): Promise<CompanyMemberResponse> {
    const operator = await this.requireOwnerOrAdmin(companyId, operatorUserId);

    const target = await this.companyRepository.findMember(companyId, targetUserId);
    if (!target) {
      throw new AppError(404, 'Member not found in this company', 'errors.memberNotFound');
    }

    if (target.role === member_role.owner && data.role && data.role !== member_role.owner) {
      throw new AppError(400, 'The owner role cannot be changed', 'errors.cannotChangeOwnerRole');
    }

    if (operator.role === member_role.admin) {
      if (target.role === member_role.admin || target.role === member_role.owner) {
        throw new AppError(403, 'Admins cannot update other admins or the owner', 'errors.unauthorized');
      }
      if (data.role === member_role.owner) {
        throw new AppError(403, 'Admins cannot promote members to owner', 'errors.unauthorized');
      }
    }

    const updateData: any = { ...data };
    if (updateData.permissions && Array.isArray(updateData.permissions)) {
      updateData.permissions = buildPermissionObject(updateData.permissions);
    }
    const updated = await this.companyRepository.updateMember(companyId, targetUserId, updateData);
    return updated as any;
  }

  async getUserCompanies(userId: string): Promise<UserCompanyResponse[]> {
    const companies = await this.companyRepository.findCompaniesByUserId(userId);
    return companies.map((company) => {
      const member = company.company_members?.[0];
      const isAdminOrOwner = member?.role === member_role.owner || member?.role === member_role.admin;
      return {
        id: company.id,
        name: company.name,
        logo_url: company.logo_url,
        created_at: company.created_at,
        updated_at: company.updated_at,
        invite_code: isAdminOrOwner ? company.invite_code : null,
        company_members: company.company_members ?? [],
      } as UserCompanyResponse;
    });
  }

  /**
   * Returns the global permission catalog for UI rendering.
   * This is intentionally company-unaware — permissions are a fixed global set.
   * If permissions ever become company-specific, this method must be updated
   * to filter by companyId.
   */
  getPermissionCatalog(): PermissionCatalogResponse {
    return {
      groups: Object.entries(PERMISSION_GROUPS).map(([group, groupDef]) => ({
        key: group,
        label: groupDef.label,
        description: groupDef.description,
        permissions: Object.entries(groupDef.permissions).map(([action, perm]) => ({
          key: `${group}.${action}`,
          label: perm.label,
          description: perm.description,
        })),
      })),
    };
  }

  async getMemberPermissions(
    companyId: string,
    targetUserId: string,
    operatorUserId: string
  ): Promise<MemberPermissionsResponse> {
    const operator = await this.requireMember(companyId, operatorUserId);

    const isOwnPermissions = operatorUserId === targetUserId;
    const isOwnerOrAdmin = operator.role === member_role.owner || operator.role === member_role.admin;
    if (!isOwnPermissions && !isOwnerOrAdmin) {
      throw new AppError(403, 'Only owners and admins can view other members\' permissions', 'errors.unauthorized');
    }

    const target = await this.companyRepository.findMember(companyId, targetUserId);
    if (!target) {
      throw new AppError(404, 'Member not found in this company', 'errors.memberNotFound');
    }

    const ownerOrAdmin =
      target.role === member_role.owner || target.role === member_role.admin;

    return {
      role: target.role,
      permissions: ownerOrAdmin
        ? allPermissionKeys()
        : flattenPermissions((target.permissions as Record<string, any>) ?? {}),
    };
  }

  async lookupCompany(code: string): Promise<{ id: string; name: string; logo_url: string | null } | null> {
    const byCode = await this.companyRepository.findByInviteCode(code);
    if (byCode) {
      return { id: byCode.id, name: byCode.name, logo_url: byCode.logo_url };
    }
    return null;
  }

  async requestJoin(inviteCode: string, userId: string): Promise<{ company_id: string; status: string }> {
    const company = await this.companyRepository.findByInviteCode(inviteCode);
    if (!company) {
      throw new AppError(404, 'Invalid invite code', 'errors.invalidInviteCode');
    }

    const existingMember = await this.companyRepository.findMember(company.id, userId);
    if (existingMember) {
      throw new AppError(409, 'You are already a member of this company', 'errors.alreadyMember');
    }

    const existingRequest = await this.companyRepository.findJoinRequest(company.id, userId);
    if (existingRequest?.status === 'pending') {
      throw new AppError(409, 'You already have a pending join request', 'errors.pendingRequest');
    }
    if (existingRequest?.status === 'approved') {
      throw new AppError(409, 'You are already approved', 'errors.alreadyApproved');
    }
    if (existingRequest?.status === 'rejected') {
      const rejectedAt = existingRequest.updated_at ?? existingRequest.created_at;
      const cooldownDeadline = new Date(Date.now() - COMPANY.JOIN_REQUEST_COOLDOWN_MS);
      if (rejectedAt && rejectedAt > cooldownDeadline) {
        throw new AppError(429, 'You must wait 5 minutes before requesting again', 'errors.tooSoon');
      }
      await this.companyRepository.resetJoinRequest(existingRequest.id);
      return { company_id: existingRequest.company_id, status: 'pending' };
    }

    const request = await this.companyRepository.createJoinRequest(company.id, userId);
    return { company_id: request.company_id, status: request.status };
  }

  async listJoinRequests(operatorUserId: string, companyId: string) {
    await this.requireOwnerOrAdmin(companyId, operatorUserId);
    return this.companyRepository.listPendingJoinRequests(companyId);
  }

  async approveJoinRequest(operatorUserId: string, companyId: string, requestId: string) {
    await this.requireOwnerOrAdmin(companyId, operatorUserId);

    const request = await this.companyRepository.findJoinRequestById(requestId, companyId);
    if (!request) {
      throw new AppError(404, 'Join request not found', 'errors.joinRequestNotFound');
    }
    if (request.status !== 'pending') {
      throw new AppError(400, 'Join request is not pending', 'errors.requestNotPending');
    }

    await this.companyRepository.approveJoinRequest(requestId, companyId, request.user_id);
    return { success: true };
  }

  async rejectJoinRequest(operatorUserId: string, companyId: string, requestId: string) {
    await this.requireOwnerOrAdmin(companyId, operatorUserId);

    const request = await this.companyRepository.findJoinRequestById(requestId, companyId);
    if (!request) {
      throw new AppError(404, 'Join request not found', 'errors.joinRequestNotFound');
    }
    if (request.status !== 'pending') {
      throw new AppError(400, 'Join request is not pending', 'errors.requestNotPending');
    }

    await this.companyRepository.rejectJoinRequest(requestId);
    return { success: true };
  }

  async regenerateInviteCode(operatorUserId: string, companyId: string) {
    await this.requireOwner(companyId, operatorUserId);

    const newCode = await this.generateInviteCode();
    await this.companyRepository.updateInviteCode(companyId, newCode);
    return { invite_code: newCode };
  }

  async getMyJoinRequests(userId: string) {
    return this.companyRepository.findJoinRequestsByUser(userId);
  }
}
