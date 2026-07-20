import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';

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
