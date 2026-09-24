import { injectable } from 'tsyringe';
import { prisma } from '../../database/prisma.js';
import { Prisma, member_role } from '../../../generated/prisma/client.js';

@injectable()
export class CompanyRepository {
  /**
   * Find a company by its ID (excludes soft-deleted)
   */
  async findById(id: string) {
    return prisma.companies.findFirst({
      where: { id, deleted_at: null },
      include: {
        company_subscriptions: {
          include: {
            subscription_plans: true,
          },
        },
      },
    });
  }

  async createCompanyWithOwner(companyData: Prisma.companiesCreateWithoutCompany_membersInput & { invite_code?: string }, ownerUserId: string) {
    return prisma.$transaction(async (tx) => {
      const createdCompany = await tx.companies.create({ data: companyData });

      await tx.company_members.create({
        data: {
          company_id: createdCompany.id,
          user_id: ownerUserId,
          role: member_role.owner,
          permissions: { all: true },
        },
      });

      return createdCompany;
    });
  }

  /**
   * Update company details
   */
  async update(id: string, data: Prisma.companiesUpdateInput) {
    return prisma.companies.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-delete a company (reversible, preserves all child data)
   */
  async softDelete(id: string) {
    return prisma.companies.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async restore(id: string) {
    return prisma.companies.update({
      where: { id },
      data: { deleted_at: null },
    });
  }

  /**
   * Hard delete — purge only. Never call from normal service flow.
   */
  async delete(id: string) {
    return prisma.companies.delete({
      where: { id },
    });
  }

  /**
   * Add a member to a company
   */
  async addMember(companyId: string, userId: string, role: member_role = member_role.member, permissions: any = {}) {
    return prisma.company_members.create({
      data: {
        company_id: companyId,
        user_id: userId,
        role,
        permissions,
      },
    });
  }

  /**
   * Update a member's role and permissions
   */
  async updateMember(companyId: string, userId: string, data: { role?: member_role; permissions?: any }) {
    return prisma.company_members.update({
      where: {
        company_id_user_id: {
          company_id: companyId,
          user_id: userId,
        },
      },
      data,
    });
  }

  /**
   * Remove a member from a company
   */
  async removeMember(companyId: string, userId: string) {
    return prisma.company_members.delete({
      where: {
        company_id_user_id: {
          company_id: companyId,
          user_id: userId,
        },
      },
    });
  }

  /**
   * Find a specific member in a company
   */
  async findMember(companyId: string, userId: string) {
    return prisma.company_members.findUnique({
      where: {
        company_id_user_id: {
          company_id: companyId,
          user_id: userId,
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            is_verified: true,
          },
        },
      },
    });
  }

  /**
   * List all members of a company
   */
  async findMembers(companyId: string, params: { page?: number; limit?: number } = {}) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.company_members.findMany({
        where: { company_id: companyId },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              is_verified: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'asc' },
      }),
      prisma.company_members.count({
        where: { company_id: companyId },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all companies associated with a specific user
   */
  async findCompaniesByUserId(userId: string) {
    return prisma.companies.findMany({
      where: {
        deleted_at: null,
        company_members: {
          some: {
            user_id: userId,
          },
        },
      },
      include: {
        company_members: {
          where: {
            user_id: userId,
          },
          select: {
            role: true,
            permissions: true,
          },
        },
      },
    });
  }

  async findByInviteCode(code: string) {
    return prisma.companies.findFirst({ where: { invite_code: code, deleted_at: null } });
  }

  async createJoinRequest(companyId: string, userId: string) {
    return prisma.join_requests.create({
      data: { company_id: companyId, user_id: userId },
    });
  }

  async findJoinRequest(companyId: string, userId: string) {
    return prisma.join_requests.findFirst({
      where: { company_id: companyId, user_id: userId },
    });
  }

  async findJoinRequestById(requestId: string, companyId: string) {
    return prisma.join_requests.findFirst({
      where: { id: requestId, company_id: companyId },
    });
  }

  async listPendingJoinRequests(companyId: string) {
    return prisma.join_requests.findMany({
      where: { company_id: companyId, status: 'pending' },
      include: { users: { select: { id: true, name: true, email: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async approveJoinRequest(requestId: string, companyId: string, userId: string) {
    return prisma.$transaction([
      prisma.company_members.create({
        data: {
          company_id: companyId,
          user_id: userId,
          role: member_role.member,
          permissions: {},
        },
      }),
      prisma.join_requests.update({
        where: { id: requestId },
        data: { status: 'approved' },
      }),
    ]);
  }

  async deleteJoinRequest(companyId: string, userId: string) {
    return prisma.join_requests.deleteMany({ where: { company_id: companyId, user_id: userId } });
  }

  async rejectJoinRequest(requestId: string) {
    return prisma.join_requests.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });
  }

  async resetJoinRequest(requestId: string) {
    return prisma.join_requests.update({
      where: { id: requestId },
      data: { status: 'pending', updated_at: new Date() },
    });
  }

  async updateInviteCode(companyId: string, inviteCode: string | null) {
    return prisma.companies.update({
      where: { id: companyId },
      data: { invite_code: inviteCode },
    });
  }

  async findJoinRequestsByUser(userId: string) {
    return prisma.join_requests.findMany({
      where: { user_id: userId },
      include: {
        companies: {
          select: { id: true, name: true, logo_url: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
