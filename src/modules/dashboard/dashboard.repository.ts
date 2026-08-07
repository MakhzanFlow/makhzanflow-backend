import { injectable } from "tsyringe";
import { prisma } from "../../database/prisma.js";

@injectable()
export class DashboardRepository {
  async countProducts(companyId: string) {
    return prisma.products.count({ where: { company_id: companyId } });
  }

  async countCustomers(companyId: string) {
    return prisma.customers.count({ where: { company_id: companyId } });
  }

  async sumTotalDebt(companyId: string) {
    const rows = await prisma.$queryRaw<Array<{ debt: number }>>`
      SELECT COALESCE(SUM(i.total_amount - COALESCE(p.paid, 0)), 0)::float8 AS debt
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS paid
        FROM payments
        GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.company_id = ${companyId}
        AND i.status IN ('pending', 'partially_paid')
    `;
    return Number(rows[0]?.debt ?? 0);
  }

  async sumPaymentsBetween(companyId: string, gte: Date, lt: Date) {
    const result = await prisma.payments.aggregate({
      where: { company_id: companyId, created_at: { gte, lt } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async sumPaymentsSince(companyId: string, since: Date) {
    const result = await prisma.payments.aggregate({
      where: { company_id: companyId, created_at: { gte: since } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async weeklySales(companyId: string, since: Date) {
    return prisma.$queryRaw<Array<{ day: Date; total: number }>>`
      SELECT DATE(created_at) AS day,
             COALESCE(SUM(total_amount), 0)::float8 AS total
      FROM invoices
      WHERE company_id = ${companyId}
        AND status != 'canceled'
        AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;
  }

  async recentActivities(companyId: string, since: Date, take: number) {
    return prisma.activity_logs.findMany({
      where: { company_id: companyId, created_at: { gte: since } },
      orderBy: { created_at: "desc" },
      take,
      include: { users: { select: { name: true } } },
    });
  }

  async findLowStock(
    companyId: string,
    skip: number,
    take: number,
    sort: string,
    order: string,
    search?: string
  ) {
    const conditions: string[] = ["stock <= min_stock", "company_id = $1"];
    const params: unknown[] = [companyId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const allowedSorts = ["name", "price", "stock", "created_at"];
    const sortCol = allowedSorts.includes(sort) ? sort : "name";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    const sql = `
      SELECT * FROM products
      WHERE ${conditions.join(" AND ")}
      ORDER BY "${sortCol}" ${sortDir}
      OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
    `;
    params.push(skip, take);

    return prisma.$queryRawUnsafe<Array<Record<string, any>>>(sql, ...params);
  }

  async countLowStock(companyId: string, search?: string) {
    const conditions: string[] = ["stock <= min_stock", "company_id = $1"];
    const params: unknown[] = [companyId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const sql = `SELECT COUNT(*)::int AS count FROM products WHERE ${conditions.join(" AND ")}`;
    const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(sql, ...params);
    return rows[0]?.count ?? 0;
  }

  async monthlyInvoices(companyId: string, from: Date, to: Date) {
    return prisma.$queryRaw<Array<{ month: string; count: number; revenue: number }>>`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
             COUNT(*)::int AS count,
             COALESCE(SUM(total_amount), 0)::float8 AS revenue
      FROM invoices
      WHERE company_id = ${companyId}
        AND status != 'canceled'
        AND created_at >= ${from}
        AND created_at < ${to}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `;
  }

  async monthlyPayments(companyId: string, from: Date, to: Date) {
    return prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0)::float8 AS total
      FROM payments
      WHERE company_id = ${companyId}
        AND created_at >= ${from}
        AND created_at < ${to}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `;
  }

  async listActivity(companyId: string, skip: number, take: number) {
    return prisma.activity_logs.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: "desc" },
      skip,
      take,
      include: { users: { select: { name: true } } },
    });
  }

  async countActivity(companyId: string) {
    return prisma.activity_logs.count({ where: { company_id: companyId } });
  }
}
