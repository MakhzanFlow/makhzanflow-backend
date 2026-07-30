import { injectable } from 'tsyringe';
import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../../generated/prisma/client.js';

@injectable()
export class CustomerRepository {
  async findById(id: string, companyId: string) {
    return prisma.customers.findFirst({
      where: { id, company_id: companyId },
      include: {
        invoices: {
          include: { payments: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  async findByIdWithInvoices(id: string, companyId: string) {
    return prisma.customers.findFirst({
      where: { id, company_id: companyId },
      include: {
        invoices: {
          where: { status: { in: ['pending', 'partially_paid'] } },
          include: { payments: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  async findByCompanyId(companyId: string, skip: number, take: number) {
    return prisma.customers.findMany({
      where: { company_id: companyId },
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }

  async countByCompanyId(companyId: string) {
    return prisma.customers.count({ where: { company_id: companyId } });
  }

  async search(companyId: string, search: string, skip: number, take: number, sort: string, order: string) {
    const orderBy = { [sort]: order } as Prisma.customersOrderByWithRelationInput;
    return prisma.customers.findMany({
      where: {
        company_id: companyId,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      },
      skip,
      take,
      orderBy,
    });
  }

  async searchCount(companyId: string, search: string) {
    return prisma.customers.count({
      where: {
        company_id: companyId,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      },
    });
  }

  async create(data: Prisma.customersUncheckedCreateInput) {
    return prisma.customers.create({ data });
  }

  async update(id: string, companyId: string, data: Prisma.customersUncheckedUpdateInput) {
    return prisma.customers.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.customers.delete({ where: { id } });
  }

  async countInvoices(id: string) {
    return prisma.invoices.count({ where: { customer_id: id } });
  }

  async findAllWithInvoices(companyId: string) {
    return prisma.customers.findMany({
      where: { company_id: companyId },
      include: {
        invoices: {
          include: { payments: true },
        },
      },
    });
  }

  async findDebtors(companyId: string, skip: number, take: number) {
    return prisma.customers.findMany({
      where: { company_id: companyId },
      include: {
        invoices: {
          where: { status: { in: ['pending', 'partially_paid'] } },
          include: { payments: true },
          orderBy: { created_at: 'desc' },
        },
      },
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }

  async updateImage(id: string, companyId: string, imageUrl: string) {
    return prisma.customers.update({
      where: { id },
      data: { image_url: imageUrl },
    });
  }

  async findLatestInvoiceNumber(companyId: string) {
    const invoice = await prisma.invoices.findFirst({
      where: { company_id: companyId, invoice_number: { startsWith: 'OB-' } },
      orderBy: { created_at: 'desc' },
    });
    return invoice?.invoice_number ?? null;
  }

  async createInvoice(data: Prisma.invoicesUncheckedCreateInput) {
    return prisma.invoices.create({ data });
  }

  async findRecentPayments(customerId: string, companyId: string, limit: number) {
    return prisma.payments.findMany({
      where: {
        invoices: {
          customer_id: customerId,
          company_id: companyId,
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        invoices: { select: { invoice_number: true } },
      },
    });
  }

  async findPaginatedInvoices(customerId: string, companyId: string, skip: number, take: number) {
    const where = { customer_id: customerId, company_id: companyId };
    return Promise.all([
      prisma.invoices.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.invoices.count({ where }),
    ]);
  }

  async findPaginatedPayments(customerId: string, companyId: string, skip: number, take: number) {
    const where = {
      invoices: { customer_id: customerId, company_id: companyId },
    };
    return Promise.all([
      prisma.payments.findMany({
        where, skip, take, orderBy: { created_at: 'desc' },
        include: { invoices: { select: { invoice_number: true } } },
      }),
      prisma.payments.count({ where }),
    ]);
  }

  async createCustomerAndInvoiceInTransaction(
    customerData: Prisma.customersUncheckedCreateInput,
    invoiceData: Prisma.invoicesUncheckedCreateInput
  ) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customers.create({ data: customerData });
      const invoice = await tx.invoices.create({
        data: { ...invoiceData, customer_id: customer.id },
      });
      return { customer, invoice };
    });
  }
}
