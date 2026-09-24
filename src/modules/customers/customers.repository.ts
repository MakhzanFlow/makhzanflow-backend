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

  async findByCompanyId(companyId: string, skip: number, take: number, sort = 'name', order = 'asc') {
    const orderBy = { [sort]: order } as Prisma.customersOrderByWithRelationInput;
    return prisma.customers.findMany({
      where: { company_id: companyId },
      skip,
      take,
      orderBy,
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
    await prisma.customers.updateMany({
      where: { id, company_id: companyId },
      data,
    });
    return this.findById(id, companyId);
  }

  async delete(id: string, companyId: string) {
    return prisma.customers.deleteMany({ where: { id, company_id: companyId } });
  }

  async countInvoices(id: string, companyId: string) {
    return prisma.invoices.count({ where: { customer_id: id, company_id: companyId } });
  }

  async updateImage(id: string, companyId: string, imageUrl: string) {
    await prisma.customers.updateMany({
      where: { id, company_id: companyId },
      data: { image_url: imageUrl },
    });
    return this.findById(id, companyId);
  }

  async findLatestInvoiceNumber(companyId: string) {
    const invoice = await prisma.invoices.findFirst({
      where: { company_id: companyId, invoice_number: { startsWith: 'OB-' } },
      orderBy: { invoice_number: 'desc' },
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

  /**
   * Debt aggregation in SQL: debt = SUM over open invoices
   * (status pending/partially_paid) of (total_amount - paid).
   * Same semantics as the service-level calculateDebt helper.
   */
  private debtInnerSql(searchParamIndex: number, withSearch: boolean): string {
    const searchClause = withSearch
      ? ` AND (c.name ILIKE $${searchParamIndex} OR c.phone ILIKE $${searchParamIndex})`
      : '';
    return `
      SELECT
        c.id, c.name, c.phone, c.email, c.address,
        c.opening_balance, c.image_url, c.created_at, c.updated_at,
        COALESCE(d.debt, 0)::float AS debt,
        (
          SELECT MAX(i2.created_at) FROM invoices i2
          WHERE i2.customer_id = c.id AND i2.company_id = $1
            AND i2.status IN ('pending', 'partially_paid')
        ) AS last_invoice_date
      FROM customers c
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.total_amount - COALESCE(p.paid, 0)) AS debt
        FROM invoices i
        LEFT JOIN (
          SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id
        ) p ON p.invoice_id = i.id
        WHERE i.company_id = $1 AND i.status IN ('pending', 'partially_paid')
        GROUP BY i.customer_id
      ) d ON d.customer_id = c.id
      WHERE c.company_id = $1${searchClause}
    `;
  }

  private debtCondition(status: 'has_debt' | 'zero_debt' | 'credit' | 'all'): string {
    switch (status) {
      case 'has_debt':
        return 'debt > 0';
      case 'zero_debt':
        return 'debt = 0';
      case 'credit':
        return 'debt < 0';
      default:
        return 'TRUE';
    }
  }

  async findCustomersDebtPage(
    companyId: string,
    opts: {
      search?: string | undefined;
      debtStatus?: 'has_debt' | 'zero_debt' | 'credit' | 'all' | undefined;
      sort?: string | undefined;
      order?: string | undefined;
      skip: number;
      take: number;
    }
  ): Promise<{ rows: Array<Record<string, any>>; total: number }> {
    const withSearch = !!opts.search;
    const params: any[] = [companyId];
    if (withSearch) params.push(`%${opts.search}%`);

    const inner = this.debtInnerSql(withSearch ? 2 : 0, withSearch);
    const condition = this.debtCondition(opts.debtStatus ?? 'all');

    const allowedSorts = ['name', 'created_at', 'opening_balance', 'debt'];
    const sortCol = allowedSorts.includes(opts.sort ?? '') ? opts.sort! : 'name';
    const sortDir = opts.order === 'desc' ? 'DESC' : 'ASC';

    const dataSql = `SELECT * FROM (${inner}) t WHERE ${condition} ORDER BY "${sortCol}" ${sortDir} OFFSET $${params.length + 1} LIMIT $${params.length + 2}`;
    const countSql = `SELECT COUNT(*)::int AS count FROM (${inner}) t WHERE ${condition}`;
    const dataParams = [...params, opts.skip, opts.take];

    const [rows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<Record<string, any>>>(dataSql, ...dataParams),
      prisma.$queryRawUnsafe<Array<{ count: number }>>(countSql, ...params),
    ]);
    return { rows, total: countRows[0]?.count ?? 0 };
  }

  async findDebtsForCustomerIds(companyId: string, customerIds: string[]): Promise<Map<string, number>> {
    if (customerIds.length === 0) return new Map();
    const rows = await prisma.$queryRawUnsafe<Array<{ customer_id: string; debt: number }>>(
      `SELECT i.customer_id, COALESCE(SUM(i.total_amount - COALESCE(p.paid, 0)), 0)::float AS debt
       FROM invoices i
       LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id
       WHERE i.company_id = $1 AND i.customer_id = ANY($2) AND i.status IN ('pending', 'partially_paid')
       GROUP BY i.customer_id`,
      companyId,
      customerIds
    );
    const map = new Map<string, number>();
    for (const id of customerIds) map.set(id, 0);
    for (const row of rows) map.set(row.customer_id, Number(row.debt));
    return map;
  }

  async countDebtBuckets(companyId: string): Promise<{ total: number; with_debt: number; zero_debt: number; credit_balance: number }> {
    const inner = this.debtInnerSql(0, false);
    const rows = await prisma.$queryRawUnsafe<Array<{ total: number; with_debt: number; zero_debt: number; credit_balance: number }>>(
      `SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE debt > 0)::int AS with_debt,
        COUNT(*) FILTER (WHERE debt = 0)::int AS zero_debt,
        COUNT(*) FILTER (WHERE debt < 0)::int AS credit_balance
       FROM (${inner}) t`,
      companyId
    );
    return rows[0] ?? { total: 0, with_debt: 0, zero_debt: 0, credit_balance: 0 };
  }
}
