import { injectable, inject } from 'tsyringe';
import { CustomerRepository } from './customers.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { StorageService } from '../../shared/storage/storage.service.js';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomerParams,
  DebtorsParams,
} from '../../types/customer.js';
import type {
  CustomerResponse,
  CustomerCreatedResponse,
  CustomerDetailResponse,
  CustomerSummaryResponse,
  CustomerDebtorItem,
  CustomerInvoiceItem,
  CustomerPaymentItem,
  CustomerDebtResponse,
} from './customers.dto.js';
import type { PaginatedResponse } from '../../shared/types/shared.dto.js';
import { CacheService } from '../../shared/cache/cache.service.js';
import { CacheKeys } from '../../shared/cache/cache-keys.js';
import { hashQuery } from '../../shared/cache/hash.js';
import { CACHE_TTL } from '../../shared/cache/constants.js';
import type { ICacheService } from '../../shared/cache/cache.interface.js';

@injectable()
export class CustomerService {
  constructor(
    @inject(CustomerRepository) private customerRepository: CustomerRepository,
    @inject(CacheService) private cache: ICacheService,
    @inject(StorageService) private storage: StorageService
  ) {}

  private generateInvoiceNumber(lastNumber: string | null): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = lastNumber ? parseInt(lastNumber.split('-')[2] ?? '0', 10) + 1 : 1;
    return `OB-${dateStr}-${String(seq).padStart(4, '0')}`;
  }

  private toCustomerResponse(customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    opening_balance: { toString: () => string } | number;
    image_url: string | null;
    created_at: Date | null;
    updated_at: Date | null;
  }, currentDebt: number): CustomerResponse {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      opening_balance: Number(customer.opening_balance),
      image_url: customer.image_url,
      current_debt: currentDebt,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
    };
  }

  async create(data: CreateCustomerInput): Promise<CustomerCreatedResponse> {
    const openingBalance = data.opening_balance ?? 0;

    const customerData = {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      opening_balance: openingBalance,
      company_id: data.company_id,
    };

    if (openingBalance > 0) {
      const lastNumber = await this.customerRepository.findLatestInvoiceNumber(data.company_id);
      const invoiceNumber = this.generateInvoiceNumber(lastNumber);

      const { customer, invoice } = await this.customerRepository.createCustomerAndInvoiceInTransaction(
        customerData,
        {
          company_id: data.company_id,
          invoice_number: invoiceNumber,
          total_amount: openingBalance,
          status: 'pending',
        }
      );

      await this.invalidateCustomerCaches(data.company_id);
      await this.cache.delPattern(CacheKeys.dashboard.monthlyReport(data.company_id, "*"));

      return {
        ...this.toCustomerResponse(customer, Number(invoice.total_amount)),
        opening_balance_invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_amount: Number(invoice.total_amount),
          status: invoice.status,
        },
      };
    }

    const customer = await this.customerRepository.create(customerData);

    await this.invalidateCustomerCaches(data.company_id);

    return this.toCustomerResponse(customer, 0);
  }

  async findById(id: string, companyId: string): Promise<CustomerDetailResponse> {
    const cacheKey = CacheKeys.customers.detail(id, companyId);
    const cached = await this.cache.get<CustomerDetailResponse>(cacheKey);
    if (cached) return cached;

    const customer = await this.customerRepository.findById(id, companyId);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const debt = this.calculateDebt(customer);

    const response: CustomerDetailResponse = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      opening_balance: Number(customer.opening_balance),
      image_url: customer.image_url,
      current_debt: debt,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
      recent_transactions: customer.invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: inv.status,
        total_amount: Number(inv.total_amount),
        paid_amount: Number(
          inv.payments.reduce((sum, p) => sum + Number(p.amount), 0)
        ),
        due_date: inv.due_date,
        created_at: inv.created_at,
      })),
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.LONG);
    return response;
  }

  async list(params: ListCustomerParams): Promise<PaginatedResponse<CustomerResponse>> {
    const { companyId, page, limit, search, sort, order, debt_status } = params;
    const skip = (page - 1) * limit;

    const cacheKey = CacheKeys.customers.list(companyId, hashQuery({ page, limit, search, sort, order, debt_status }));
    const cached = await this.cache.get<PaginatedResponse<CustomerResponse>>(cacheKey);
    if (cached) return cached;

    let customers;
    let total;

    if (debt_status && debt_status !== 'all') {
      // Debt is derived from invoices — filter and paginate in SQL.
      const { rows, total: debtTotal } = await this.customerRepository.findCustomersDebtPage(companyId, {
        search,
        debtStatus: debt_status as 'has_debt' | 'zero_debt' | 'credit',
        sort,
        order,
        skip,
        take: limit,
      });
      const result = rows.map((c) => this.toCustomerResponse(c as any, Number(c.debt)));

      const response: PaginatedResponse<CustomerResponse> = {
        data: result,
        pagination: {
          page,
          limit,
          total: debtTotal,
          pages: Math.ceil(debtTotal / limit),
        },
      };

      await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
      return response;
    } else if (search) {
      customers = await this.customerRepository.search(
        companyId,
        search,
        skip,
        limit,
        sort ?? 'name',
        order ?? 'asc'
      );
      total = await this.customerRepository.searchCount(companyId, search);
    } else {
      customers = await this.customerRepository.findByCompanyId(
        companyId,
        skip,
        limit,
        sort ?? 'name',
        order ?? 'asc'
      );
      total = await this.customerRepository.countByCompanyId(companyId);
    }

    // Batch debt lookup for exactly the customers on this page (SQL aggregation).
    const debtMap = await this.customerRepository.findDebtsForCustomerIds(
      companyId,
      customers.map((c) => c.id)
    );

    let result = customers.map((c) => this.toCustomerResponse(c, debtMap.get(c.id) ?? 0));


    const response: PaginatedResponse<CustomerResponse> = {
      data: result,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }

  async update(id: string, companyId: string, data: UpdateCustomerInput, imageUrl?: string): Promise<CustomerResponse> {
    const existing = await this.customerRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (trimmed.length === 0) {
        throw new AppError(400, 'Name is required', 'errors.validation');
      }
      updateData.name = trimmed;
    }
    if (data.phone !== undefined) updateData.phone = data.phone ?? null;
    if (data.email !== undefined) updateData.email = data.email ?? null;
    if (data.address !== undefined) updateData.address = data.address ?? null;

    if (imageUrl) {
      updateData.image_url = imageUrl;
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError(400, 'Nothing to update', 'errors.validation');
    }

    const customer = await this.customerRepository.update(id, companyId, updateData);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const debt = this.calculateDebt(customer);

    await this.cache.del(CacheKeys.customers.detail(id, companyId));
    await this.invalidateCustomerCaches(companyId);

    return this.toCustomerResponse(customer, debt);
  }

  async delete(id: string, companyId: string): Promise<void> {
    const existing = await this.customerRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const invoiceCount = await this.customerRepository.countInvoices(id, companyId);
    if (invoiceCount > 0) {
      throw new AppError(
        400,
        'Cannot delete customer with existing invoices',
        'errors.customerHasInvoices'
      );
    }

    await this.customerRepository.delete(id, companyId);

    await this.cache.del(CacheKeys.customers.detail(id, companyId));
    await this.invalidateCustomerCaches(companyId);
  }

  async getDebt(id: string, companyId: string): Promise<CustomerDebtResponse> {
    const cacheKey = CacheKeys.customers.debt(id, companyId);
    const cached = await this.cache.get<CustomerDebtResponse>(cacheKey);
    if (cached) return cached;

    const customer = await this.customerRepository.findByIdWithInvoices(id, companyId);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const openingBalance = Number(customer.opening_balance);
    let totalInvoiceAmount = 0;
    let totalPaid = 0;
    const breakdown: CustomerDebtResponse['breakdown'] = [];

    for (const invoice of customer.invoices) {
      if (invoice.status === 'canceled') continue;
      const invTotal = Number(invoice.total_amount);
      const invPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      totalInvoiceAmount += invTotal;
      totalPaid += invPaid;

      breakdown.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        total_amount: invTotal,
        paid_amount: invPaid,
        due: invTotal - invPaid,
      });
    }

    const currentDebt = totalInvoiceAmount - totalPaid;

    const recentPayments = await this.customerRepository.findRecentPayments(id, companyId, 10);

    const response: CustomerDebtResponse = {
      customer_id: customer.id,
      customer_name: customer.name,
      opening_balance: openingBalance,
      total_invoice_amount: totalInvoiceAmount,
      total_paid: totalPaid,
      current_debt: currentDebt,
      breakdown,
      recent_payments: recentPayments.map((p) => ({
        id: p.id,
        invoice_id: p.invoice_id,
        invoice_number: p.invoices.invoice_number,
        amount: Number(p.amount),
        method: p.method,
        reference_number: p.reference_number,
        notes: p.notes,
        created_at: p.created_at,
      })),
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }

  async getInvoices(id: string, companyId: string, page: number, limit: number): Promise<PaginatedResponse<CustomerInvoiceItem>> {
    const skip = (page - 1) * limit;
    const customer = await this.customerRepository.findById(id, companyId);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const cacheKey = CacheKeys.customers.invoices(id, companyId, hashQuery({ page, limit }));
    const cached = await this.cache.get<PaginatedResponse<CustomerInvoiceItem>>(cacheKey);
    if (cached) return cached;

    const [invoices, total] = await this.customerRepository.findPaginatedInvoices(id, companyId, skip, limit);

    const response: PaginatedResponse<CustomerInvoiceItem> = {
      data: invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: inv.status,
        total_amount: Number(inv.total_amount),
        discount_amount: Number(inv.discount_amount),
        tax_amount: Number(inv.tax_amount),
        due_date: inv.due_date,
        created_at: inv.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }

  async getPayments(id: string, companyId: string, page: number, limit: number): Promise<PaginatedResponse<CustomerPaymentItem>> {
    const skip = (page - 1) * limit;
    const customer = await this.customerRepository.findById(id, companyId);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const cacheKey = CacheKeys.customers.payments(id, companyId, hashQuery({ page, limit }));
    const cached = await this.cache.get<PaginatedResponse<CustomerPaymentItem>>(cacheKey);
    if (cached) return cached;

    const [payments, total] = await this.customerRepository.findPaginatedPayments(id, companyId, skip, limit);

    const response: PaginatedResponse<CustomerPaymentItem> = {
      data: payments.map((p) => ({
        id: p.id,
        invoice_id: p.invoice_id,
        invoice_number: p.invoices.invoice_number,
        amount: Number(p.amount),
        method: p.method,
        reference_number: p.reference_number,
        notes: p.notes,
        created_at: p.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }

  async getSummary(companyId: string): Promise<CustomerSummaryResponse> {
    const cacheKey = CacheKeys.customers.summary(companyId);
    const cached = await this.cache.get<CustomerSummaryResponse>(cacheKey);
    if (cached) return cached;

    const buckets = await this.customerRepository.countDebtBuckets(companyId);

    const response: CustomerSummaryResponse = {
      total: buckets.total,
      with_debt: buckets.with_debt,
      zero_debt: buckets.zero_debt,
      credit_balance: buckets.credit_balance,
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.SHORT);
    return response;
  }

  async getDebtors(params: DebtorsParams): Promise<PaginatedResponse<CustomerDebtorItem>> {
    const { companyId, page, limit, search } = params;
    const skip = (page - 1) * limit;

    const cacheKey = CacheKeys.customers.debtors(companyId, hashQuery({ page, limit, search }));
    const cached = await this.cache.get<PaginatedResponse<CustomerDebtorItem>>(cacheKey);
    if (cached) return cached;

    const { rows, total } = await this.customerRepository.findCustomersDebtPage(companyId, {
      search,
      debtStatus: 'has_debt',
      sort: 'debt',
      order: 'desc',
      skip,
      take: limit,
    });

    const data = rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      opening_balance: Number(c.opening_balance),
      current_debt: Number(c.debt),
      last_invoice_date: c.last_invoice_date ?? null,
    }));

    const response: PaginatedResponse<CustomerDebtorItem> = {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }

  async uploadImage(id: string, companyId: string, imageUrl: string): Promise<{ image_url: string | null }> {
    const existing = await this.customerRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const customer = await this.customerRepository.updateImage(id, companyId, imageUrl);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    await this.cache.del(CacheKeys.customers.detail(id, companyId));
    await this.cache.delPattern(CacheKeys.customers.list(companyId, "*"));

    return { image_url: customer.image_url };
  }

  async uploadImageWithBuffer(id: string, companyId: string, buffer: Buffer): Promise<{ image_url: string | null }> {
    const existing = await this.customerRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }
    const imageUrl = await this.storage.uploadBuffer(buffer, 'customer_images');
    return this.uploadImage(id, companyId, imageUrl);
  }

  private async invalidateCustomerCaches(companyId: string): Promise<void> {
    await this.cache.delPattern(CacheKeys.customers.list(companyId, "*"));
    await this.cache.del(CacheKeys.customers.summary(companyId));
    await this.cache.delPattern(CacheKeys.customers.debtors(companyId, "*"));
    await this.cache.del(CacheKeys.dashboard.stats(companyId));
  }

  private calculateDebt(customer: {
    opening_balance: { toString: () => string } | number;
    invoices?: Array<{
      total_amount: { toString: () => string } | number;
      status: string;
      payments?: Array<{ amount: { toString: () => string } | number }>;
    }>;
  }): number {
    let totalUnpaid = 0;

    for (const invoice of customer.invoices ?? []) {
      if (invoice.status === 'paid' || invoice.status === 'canceled') continue;
      const invTotal = Number(invoice.total_amount);
      const invPaid = (invoice.payments ?? []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      totalUnpaid += invTotal - invPaid;
    }

    return totalUnpaid;
  }
}
