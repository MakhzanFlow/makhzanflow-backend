import { CompanyRepository } from './company.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { member_role } from '../../../generated/prisma/client.js';
import { uploadImageBase64 } from '../../shared/utils/cloudinary.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

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

  /**
   * Create a new company and assign the requesting user as the Owner
   */
  async createCompany(data: { name: string; logo_url?: string }, ownerUserId: string) {
    if (!data.name || data.name.trim() === '') {
      throw new AppError(400, 'Company name is required', 'errors.companyNameRequired');
    }

    const existing = await this.companyRepository.findByName(data.name);
    if (existing) {
      throw new AppError(409, 'A company with this name already exists', 'errors.companyExists');
    }

    const logoUrl = await this.resolveLogoUrl(data.logo_url);

    return this.companyRepository.createCompanyWithOwner(
      { name: data.name, logo_url: logoUrl },
      ownerUserId
    );
  }

  /**
   * Get company profile (only accessible by its members)
   */
  async getCompanyDetails(companyId: string, userId: string) {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership) {
      throw new AppError(403, 'You do not have access to this company', 'errors.forbidden');
    }

    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new AppError(404, 'Company not found', 'errors.companyNotFound');
    }

    return company;
  }

  /**
   * Update company profile (only accessible by Owner or Admin)
   */
  async updateCompany(companyId: string, data: { name?: string; logo_url?: string }, userId: string) {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership || (membership.role !== member_role.owner && membership.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can update company details', 'errors.unauthorized');
    }

    const { logo_url, ...cleanData } = data;

    return this.companyRepository.update(companyId, {
      ...cleanData,
      ...(logo_url !== undefined && { logo_url: await this.resolveLogoUrl(logo_url) }),
    });
  }

  /**
   * Delete company (only accessible by Owner)
   */
  async deleteCompany(companyId: string, userId: string) {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership || membership.role !== member_role.owner) {
      throw new AppError(403, 'Only the owner can delete the company', 'errors.unauthorized');
    }

    return this.companyRepository.delete(companyId);
  }

  /**
   * List members of a company (accessible by any member)
   */
  async listMembers(companyId: string, userId: string, pagination: { page?: number; limit?: number }) {
    const membership = await this.companyRepository.findMember(companyId, userId);
    if (!membership) {
      throw new AppError(403, 'You do not have access to this company', 'errors.forbidden');
    }

    return this.companyRepository.findMembers(companyId, pagination);
  }

  /**
   * Add a member to the company (accessible by Owner or Admin)
   */
  async addMember(
    companyId: string,
    targetUserId: string,
    role: member_role,
    permissions: any = {},
    operatorUserId: string
  ) {
    // 1. Verify operator has rights
    const operator = await this.companyRepository.findMember(companyId, operatorUserId);
    if (!operator || (operator.role !== member_role.owner && operator.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can add members', 'errors.unauthorized');
    }

    // 2. Check if user is already a member
    const existingMember = await this.companyRepository.findMember(companyId, targetUserId);
    if (existingMember) {
      throw new AppError(400, 'User is already a member of this company', 'errors.alreadyMember');
    }

    return this.companyRepository.addMember(companyId, targetUserId, role, permissions);
  }

  /**
   * Remove a member from the company
   */
  async removeMember(companyId: string, targetUserId: string, operatorUserId: string) {
    // 1. Verify operator has rights
    const operator = await this.companyRepository.findMember(companyId, operatorUserId);
    if (!operator || (operator.role !== member_role.owner && operator.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can remove members', 'errors.unauthorized');
    }

    // 2. Check target membership
    const target = await this.companyRepository.findMember(companyId, targetUserId);
    if (!target) {
      throw new AppError(404, 'Member not found', 'errors.memberNotFound');
    }

    // 3. Prevent removing the owner
    if (target.role === member_role.owner) {
      throw new AppError(400, 'The owner cannot be removed from the company', 'errors.cannotRemoveOwner');
    }

    // 4. Admins cannot remove other admins or the owner
    if (operator.role === member_role.admin && target.role === member_role.admin) {
      throw new AppError(403, 'Admins cannot remove other admins', 'errors.unauthorized');
    }

    return this.companyRepository.removeMember(companyId, targetUserId);
  }

  /**
   * Update a member's role or permissions (accessible by Owner or Admin)
   */
  async updateMember(
    companyId: string,
    targetUserId: string,
    data: { role?: member_role; permissions?: any },
    operatorUserId: string
  ) {
    // 1. Verify operator membership
    const operator = await this.companyRepository.findMember(companyId, operatorUserId);
    if (!operator || (operator.role !== member_role.owner && operator.role !== member_role.admin)) {
      throw new AppError(403, 'Only owners and admins can update members', 'errors.unauthorized');
    }

    // 2. Find target member
    const target = await this.companyRepository.findMember(companyId, targetUserId);
    if (!target) {
      throw new AppError(404, 'Member not found in this company', 'errors.memberNotFound');
    }

    // 3. Owners cannot be demoted or changed by admins
    if (target.role === member_role.owner && data.role && data.role !== member_role.owner) {
      throw new AppError(400, 'The owner role cannot be changed', 'errors.cannotChangeOwnerRole');
    }

    // 4. Admins cannot modify other admins or the owner
    if (operator.role === member_role.admin) {
      if (target.role === member_role.admin || target.role === member_role.owner) {
        throw new AppError(403, 'Admins cannot update other admins or the owner', 'errors.unauthorized');
      }
      // Admins cannot promote anyone to owner
      if (data.role === member_role.owner) {
        throw new AppError(403, 'Admins cannot promote members to owner', 'errors.unauthorized');
      }
    }

    return this.companyRepository.updateMember(companyId, targetUserId, data);
  }

  /**
   * Get all companies associated with a specific user
   */
  async getUserCompanies(userId: string) {
    return this.companyRepository.findCompaniesByUserId(userId);
  }
}