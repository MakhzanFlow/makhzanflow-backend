import { injectable, inject } from 'tsyringe';
import { CustomerRepository } from './customers.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
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
    @inject(CacheService) private cache: ICacheService
  ) {}

  private generateInvoiceNumber(companyId: string, lastNumber: string | null): string {
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
      const invoiceNumber = this.generateInvoiceNumber(data.company_id, lastNumber);

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

    if (search) {
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
        limit
      );
      total = await this.customerRepository.countByCompanyId(companyId);
    }

    const allWithDebt = await this.customerRepository.findAllWithInvoices(companyId);
    const debtMap = new Map<string, number>();
    for (const c of allWithDebt) {
      debtMap.set(c.id, this.calculateDebt(c));
    }

    let result = customers.map((c) => this.toCustomerResponse(c, debtMap.get(c.id) ?? Number(c.opening_balance)));

    if (debt_status && debt_status !== 'all') {
      result = result.filter((c) => {
        if (debt_status === 'has_debt') return c.current_debt > 0;
        if (debt_status === 'zero_debt') return c.current_debt === 0;
        if (debt_status === 'credit') return c.current_debt < 0;
        return true;
      });
    }

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

    const updateData: Record<string, any> = {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
    };

    if (imageUrl) {
      updateData.image_url = imageUrl;
    }

    const customer = await this.customerRepository.update(id, companyId, updateData);

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

    const invoiceCount = await this.customerRepository.countInvoices(id);
    if (invoiceCount > 0) {
      throw new AppError(
        400,
        'Cannot delete customer with existing invoices',
        'errors.customerHasInvoices'
      );
    }

    await this.customerRepository.delete(id);

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

    const customers = await this.customerRepository.findAllWithInvoices(companyId);

    let withDebt = 0;
    let zeroDebt = 0;
    let creditBalance = 0;

    for (const c of customers) {
      const debt = this.calculateDebt(c);
      if (debt > 0) withDebt++;
      else if (debt === 0) zeroDebt++;
      else creditBalance++;
    }

    const response: CustomerSummaryResponse = {
      total: customers.length,
      with_debt: withDebt,
      zero_debt: zeroDebt,
      credit_balance: creditBalance,
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

    const allCustomers = await this.customerRepository.findAllWithInvoices(companyId);

    const withDebt = allCustomers
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        opening_balance: Number(c.opening_balance),
        current_debt: this.calculateDebt(c),
        last_invoice_date: c.invoices[0]?.created_at ?? null,
      }))
      .filter((c) => c.current_debt > 0)
      .filter((c) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return c.name.toLowerCase().includes(s) || (c.phone ?? '').toLowerCase().includes(s);
      })
      .sort((a, b) => b.current_debt - a.current_debt);

    const total = withDebt.length;
    const data = withDebt.slice(skip, skip + limit);

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

    await this.cache.del(CacheKeys.customers.detail(id, companyId));
    await this.cache.delPattern(CacheKeys.customers.list(companyId, "*"));

    return { image_url: customer.image_url };
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
