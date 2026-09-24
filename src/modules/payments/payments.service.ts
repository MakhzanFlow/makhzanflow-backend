import { injectable, inject } from "tsyringe";
import { PaymentRepository } from "./payments.repository.js";
import type { PaginatedResponse } from "../../shared/types/shared.dto.js";
import { CacheService } from "../../shared/cache/cache.service.js";
import { CacheKeys } from "../../shared/cache/cache-keys.js";
import { hashQuery } from "../../shared/cache/hash.js";
import { CACHE_TTL } from "../../shared/cache/constants.js";
import type { ICacheService } from "../../shared/cache/cache.interface.js";

export interface ListPaymentsParams {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  start_date?: string;
  end_date?: string;
  sort?: string;
  order?: "asc" | "desc";
}

@injectable()
export class PaymentService {
  constructor(
    @inject(PaymentRepository) private paymentRepository: PaymentRepository,
    @inject(CacheService) private cache: ICacheService
  ) {}

  async list(params: ListPaymentsParams): Promise<PaginatedResponse<any>> {
    const { companyId, page, limit, search, start_date, end_date, sort, order } = params;
    const skip = (page - 1) * limit;

    const cacheKey = CacheKeys.payments.list(companyId, hashQuery({ page, limit, search, start_date, end_date, sort, order }));
    const cached = await this.cache.get<PaginatedResponse<any>>(cacheKey);
    if (cached) return cached;

    const where: Record<string, any> = { company_id: companyId };
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(`${start_date}T00:00:00.000Z`);
      if (end_date) where.created_at.lte = new Date(`${end_date}T23:59:59.999Z`);
    }
    if (search) {
      where.OR = [
        { reference_number: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { invoices: { invoice_number: { contains: search, mode: "insensitive" } } },
      ];
    }

    const orderBy = { [sort ?? "created_at"]: order ?? "desc" } as any;
    const [payments, total] = await Promise.all([
      this.paymentRepository.findMany(where, skip, limit, orderBy),
      this.paymentRepository.count(where),
    ]);

    const response: PaginatedResponse<any> = {
      data: payments.map((p: any) => ({
        id: p.id,
        company_id: p.company_id,
        invoice_id: p.invoice_id,
        amount: Number(p.amount),
        method: p.method,
        reference_number: p.reference_number,
        notes: p.notes,
        created_at: p.created_at,
        invoices: p.invoices ?? null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }
}
