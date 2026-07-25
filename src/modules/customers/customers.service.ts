import { CustomerRepository } from './customers.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomerParams,
  DebtorsParams,
  CustomerDebt,
  DebtBreakdownItem,
  CustomerDetail,
  CustomerListItem,
  CustomerSummary,
  CustomerDebtorItem,
  PaginatedResult,
  ImageUploadResult,
} from '../../types/customer.js';

export class CustomerService {
  constructor(private customerRepository: CustomerRepository) {}

  private generateInvoiceNumber(companyId: string, lastNumber: string | null): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = lastNumber ? parseInt(lastNumber.split('-')[2] ?? '0', 10) + 1 : 1;
    return `OB-${dateStr}-${String(seq).padStart(4, '0')}`;
  }

  async create(data: CreateCustomerInput) {
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

      return {
        ...customer,
        current_debt: Number(invoice.total_amount),
        opening_balance_invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_amount: Number(invoice.total_amount),
          status: invoice.status,
        },
      };
    }

    const customer = await this.customerRepository.create(customerData);

    return {
      ...customer,
      current_debt: 0,
    };
  }

  async findById(id: string, companyId: string) {
    const customer = await this.customerRepository.findById(id, companyId);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const debt = this.calculateDebt(customer);

    return {
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
  }

  async list(params: ListCustomerParams) {
    const { companyId, page, limit, search, sort, order, debt_status } = params;
    const skip = (page - 1) * limit;

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

    let result = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      opening_balance: Number(c.opening_balance),
      image_url: c.image_url,
      current_debt: debtMap.get(c.id) ?? Number(c.opening_balance),
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    if (debt_status && debt_status !== 'all') {
      result = result.filter((c) => {
        if (debt_status === 'has_debt') return c.current_debt > 0;
        if (debt_status === 'zero_debt') return c.current_debt === 0;
        if (debt_status === 'credit') return c.current_debt < 0;
        return true;
      });
    }

    return {
      data: result,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, companyId: string, data: UpdateCustomerInput, imageUrl?: string) {
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

    return {
      ...customer,
      current_debt: debt,
    };
  }

  async delete(id: string, companyId: string) {
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
  }

  async getDebt(id: string, companyId: string): Promise<CustomerDebt> {
    const customer = await this.customerRepository.findByIdWithInvoices(id, companyId);
    if (!customer) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const openingBalance = Number(customer.opening_balance);
    let totalInvoiceAmount = 0;
    let totalPaid = 0;
    const breakdown: DebtBreakdownItem[] = [];

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

    return {
      customer_id: customer.id,
      customer_name: customer.name,
      opening_balance: openingBalance,
      total_invoice_amount: totalInvoiceAmount,
      total_paid: totalPaid,
      current_debt: currentDebt,
      breakdown,
    };
  }

  async getSummary(companyId: string) {
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

    return {
      total: customers.length,
      with_debt: withDebt,
      zero_debt: zeroDebt,
      credit_balance: creditBalance,
    };
  }

  async getDebtors(params: DebtorsParams) {
    const { companyId, page, limit, search } = params;
    const skip = (page - 1) * limit;

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

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async uploadImage(id: string, companyId: string, imageUrl: string) {
    const existing = await this.customerRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError(404, 'Customer not found', 'errors.customerNotFound');
    }

    const customer = await this.customerRepository.updateImage(id, companyId, imageUrl);
    return { image_url: customer.image_url };
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
