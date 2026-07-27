import { injectable } from "tsyringe";
import { prisma } from "../../database/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

@injectable()
export class ProductRepository {
  async create(data: Prisma.productsUncheckedCreateInput) {
    return prisma.products.create({ data });
  }

  async findById(id: string, companyId: string) {
    return prisma.products.findFirst({
      where: { id, company_id: companyId },
    });
  }

  async findAll(
    where: Prisma.productsWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.productsOrderByWithRelationInput = { name: "asc" }
  ) {
    return prisma.products.findMany({ where, skip, take, orderBy });
  }

  async countAll(where: Prisma.productsWhereInput) {
    return prisma.products.count({ where });
  }

  async findLowStock(
    filters: {
      companyId: string;
      skip: number;
      take: number;
      sort: string;
      order: string;
      search?: string | undefined;
      expiry_before?: Date | undefined;
      expiry_after?: Date | undefined;
      is_active?: boolean | undefined;
    }
  ) {
    const conditions: string[] = ["stock <= min_stock", "company_id = $1"];
    const params: any[] = [filters.companyId];
    let paramIndex = 2;

    if (filters.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    if (filters.expiry_before) {
      conditions.push(`expiry_date <= $${paramIndex}`);
      params.push(filters.expiry_before);
      paramIndex++;
    }
    if (filters.expiry_after) {
      conditions.push(`expiry_date >= $${paramIndex}`);
      params.push(filters.expiry_after);
      paramIndex++;
    }
    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(filters.is_active);
      paramIndex++;
    }

    const allowedSorts = ["name", "price", "stock", "created_at", "expiry_date"];
    const sortCol = allowedSorts.includes(filters.sort) ? filters.sort : "name";
    const sortDir = filters.order === "desc" ? "DESC" : "ASC";

    const sql = `
      SELECT * FROM products
      WHERE ${conditions.join(" AND ")}
      ORDER BY "${sortCol}" ${sortDir}
      OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
    `;
    params.push(filters.skip, filters.take);

    return prisma.$queryRawUnsafe<Array<Record<string, any>>>(sql, ...params);
  }

  async countLowStock(filters: {
    companyId: string;
    search?: string | undefined;
    expiry_before?: Date | undefined;
    expiry_after?: Date | undefined;
    is_active?: boolean | undefined;
  }) {
    const conditions: string[] = ["stock <= min_stock", "company_id = $1"];
    const params: any[] = [filters.companyId];
    let paramIndex = 2;

    if (filters.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    if (filters.expiry_before) {
      conditions.push(`expiry_date <= $${paramIndex}`);
      params.push(filters.expiry_before);
      paramIndex++;
    }
    if (filters.expiry_after) {
      conditions.push(`expiry_date >= $${paramIndex}`);
      params.push(filters.expiry_after);
      paramIndex++;
    }
    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(filters.is_active);
      paramIndex++;
    }

    const sql = `SELECT COUNT(*) as count FROM products WHERE ${conditions.join(" AND ")}`;
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql, ...params);
    return Number(result[0]?.count ?? 0);
  }

  async update(id: string, companyId: string, data: Prisma.productsUncheckedUpdateInput) {
    return prisma.products.update({
      where: { id, company_id: companyId },
      data,
    });
  }

  async delete(id: string, companyId: string) {
    return prisma.products.delete({ where: { id, company_id: companyId } });
  }

  async findBySku(sku: string, companyId: string) {
    return prisma.products.findFirst({
      where: { sku, company_id: companyId },
    });
  }

  async countInvoiceReferences(id: string) {
    return prisma.invoice_items.count({ where: { product_id: id } });
  }
}
