import { injectable } from "tsyringe";
import { prisma } from "../../database/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";

@injectable()
export class PaymentRepository {
  async findMany(where: Prisma.paymentsWhereInput, skip: number, take: number, orderBy: Prisma.paymentsOrderByWithRelationInput) {
    return prisma.payments.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        invoices: {
          select: {
            invoice_number: true,
            status: true,
            customer_id: true,
            customers: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async count(where: Prisma.paymentsWhereInput) {
    return prisma.payments.count({ where });
  }
}
