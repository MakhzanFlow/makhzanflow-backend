import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';

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
