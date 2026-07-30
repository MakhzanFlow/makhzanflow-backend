import { CompanyRepository } from './company.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { member_role } from '../../../generated/prisma/client.js';
import { uploadImageBase64 } from '../../shared/utils/cloudinary.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { buildPermissionObject } from '../../shared/constants/permissions.js';
import type {
  CompanyResponse,
  CompanyWithSubscription,
  CompanyMemberResponse,
  UserCompanyResponse,
} from './company.dto.js';
import type { PaginatedResponse } from '../../shared/types/shared.dto.js';

export class CompanyService {
  constructor(private companyRepository: CompanyRepository) {}

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

  private toCompanyResponse(company: { id: string; name: string; logo_url: string | null; created_at: Date | null; updated_at: Date | null }): CompanyResponse {
    return {
      id: company.id,
      name: company.name,
      logo_url: company.logo_url,
      created_at: company.created_at,
      updated_at: company.updated_at,
    };
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

    const company = await this.companyRepository.createCompanyWithOwner(
      { name: data.name, logo_url: logoUrl },
      ownerUserId
    );

    return this.toCompanyResponse(company);
  }

  async getCompanyDetails(companyId: string, userId: string): Promise<CompanyWithSubscription> {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership) {
      throw new AppError(403, 'You do not have access to this company', 'errors.forbidden');
    }

    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new AppError(404, 'Company not found', 'errors.companyNotFound');
    }

    return {
      id: company.id,
      name: company.name,
      logo_url: company.logo_url,
      created_at: company.created_at,
      updated_at: company.updated_at,
      company_subscriptions: (company.company_subscriptions ?? []) as any,
    };
  }

  async updateCompany(companyId: string, data: { name?: string; logo_url?: string }, userId: string): Promise<CompanyResponse> {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership || (membership.role !== member_role.owner && membership.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can update company details', 'errors.unauthorized');
    }

    const { logo_url, ...cleanData } = data;

    const company = await this.companyRepository.update(companyId, {
      ...cleanData,
      ...(logo_url !== undefined && { logo_url: await this.resolveLogoUrl(logo_url) }),
    });

    return this.toCompanyResponse(company);
  }

  async deleteCompany(companyId: string, userId: string): Promise<CompanyResponse> {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership || membership.role !== member_role.owner) {
      throw new AppError(403, 'Only the owner can delete the company', 'errors.unauthorized');
    }

    const company = await this.companyRepository.delete(companyId);
    return this.toCompanyResponse(company);
  }

  async listMembers(companyId: string, userId: string, pagination: { page?: number; limit?: number }): Promise<PaginatedResponse<CompanyMemberResponse>> {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership) {
      throw new AppError(403, 'You do not have access to this company', 'errors.forbidden');
    }

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
    const operator = await this.companyRepository.findMember(companyId, operatorUserId);
    if (!operator || (operator.role !== member_role.owner && operator.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can add members', 'errors.unauthorized');
    }

    const existingMember = await this.companyRepository.findMember(companyId, targetUserId);
    if (existingMember) {
      throw new AppError(400, 'User is already a member of this company', 'errors.alreadyMember');
    }

    const permObject = Array.isArray(permissions) ? buildPermissionObject(permissions) : permissions;
    const member = await this.companyRepository.addMember(companyId, targetUserId, role, permObject);
    return member as any;
  }

  async removeMember(companyId: string, targetUserId: string, operatorUserId: string): Promise<CompanyMemberResponse> {
    const operator = await this.companyRepository.findMember(companyId, operatorUserId);
    if (!operator || (operator.role !== member_role.owner && operator.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can remove members', 'errors.unauthorized');
    }

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
    const operator = await this.companyRepository.findMember(companyId, operatorUserId);
    if (!operator || (operator.role !== member_role.owner && operator.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can update members', 'errors.unauthorized');
    }

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
    return companies as any;
  }
}
