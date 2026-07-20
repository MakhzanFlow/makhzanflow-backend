import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../../generated/prisma/client.js';

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.users.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return prisma.users.findUnique({ where: { id } });
  }

  async create(data: Prisma.usersCreateInput) {
    return prisma.users.create({ data });
  }

  async update(id: string, data: Prisma.usersUpdateInput) {
    return prisma.users.update({ where: { id }, data });
  }
}

export class RefreshTokenRepository {
  async create(data: Prisma.refresh_tokensCreateInput) {
    return prisma.refresh_tokens.create({ data });
  }

  async findByToken(token: string) {
    return prisma.refresh_tokens.findUnique({ where: { token } });
  }

  async deleteByUserId(userId: string) {
    return prisma.refresh_tokens.deleteMany({ where: { user_id: userId } });
  }

  async deleteByToken(token: string) {
    return prisma.refresh_tokens.delete({ where: { token } });
  }
}

export class VerificationTokenRepository {
  async create(data: Prisma.verification_tokensCreateInput) {
    return prisma.verification_tokens.create({ data });
  }

  async findByToken(token: string) {
    return prisma.verification_tokens.findUnique({ where: { token } });
  }

  async findByUserId(userId: string) {
    // Note: Assuming we have an index on user_id, or we just want the latest one
    return prisma.verification_tokens.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async deleteByUserId(userId: string) {
    return prisma.verification_tokens.deleteMany({ where: { user_id: userId } });
  }
}
