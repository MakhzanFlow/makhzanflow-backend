import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';

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
