import { injectable, inject } from "tsyringe";
import { InvoiceRepository } from "./invoices.repository.js";
import { ActivityLogService } from "../activity-logs/activity-logs.service.js";
import { CustomerRepository } from "../customers/customers.repository.js";
import { AppError } from "../../shared/errors/app-error.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { CreateInvoiceInput, AddInvoicePaymentInput, ListInvoicesParams } from "../../types/invoices.js";
import type {
  InvoiceResponse,
  InvoiceListItemResponse,
} from './invoices.dto.js';
import type { PaginatedResponse } from '../../shared/types/shared.dto.js';

@injectable()
export class InvoiceService {
  constructor(
    @inject(InvoiceRepository) private invoiceRepository: InvoiceRepository,
    @inject(CustomerRepository) private customerRepository: CustomerRepository,
    @inject(ActivityLogService) private activityLogService: ActivityLogService
  ) {}

  private toInvoiceResponse(invoice: any): InvoiceResponse {
    return {
      id: invoice.id,
      company_id: invoice.company_id,
      customer_id: invoice.customer_id,
      user_id: invoice.user_id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      total_amount: Number(invoice.total_amount),
      discount_amount: Number(invoice.discount_amount),
      tax_amount: Number(invoice.tax_amount),
      due_date: invoice.due_date,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      invoice_items: (invoice.invoice_items ?? []).map((item: any) => ({
        id: item.id,
        invoice_id: item.invoice_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
        products: {
          name: item.products.name,
          image_url: item.products.image_url,
          price: Number(item.products.price),
        },
      })),
      payments: (invoice.payments ?? []).map((p: any) => ({
        id: p.id,
        invoice_id: p.invoice_id,
        amount: Number(p.amount),
        method: p.method,
        reference_number: p.reference_number,
        notes: p.notes,
        created_at: p.created_at,
      })),
      customers: invoice.customers ?? null,
      users: invoice.users,
    };
  }

  private toInvoiceListItemResponse(invoice: any): InvoiceListItemResponse {
    return {
      id: invoice.id,
      company_id: invoice.company_id,
      customer_id: invoice.customer_id,
      user_id: invoice.user_id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      total_amount: Number(invoice.total_amount),
      discount_amount: Number(invoice.discount_amount),
      tax_amount: Number(invoice.tax_amount),
      due_date: invoice.due_date,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      customers: invoice.customers ?? null,
      payments: (invoice.payments ?? []).map((p: any) => ({
        id: p.id,
        invoice_id: p.invoice_id,
        amount: Number(p.amount),
        method: p.method,
        reference_number: p.reference_number,
        notes: p.notes,
        created_at: p.created_at,
      })),
      users: invoice.users,
    };
  }

  async create(data: CreateInvoiceInput, userId: string): Promise<InvoiceResponse> {
    if (data.customer_id) {
      const customer = await this.customerRepository.findById(data.customer_id, data.company_id);
      if (!customer) {
        throw new AppError(404, "Customer not found", "errors.customerNotFound");
      }
    }

    const invoice = await this.invoiceRepository.createTransactional(data, userId);

    await this.activityLogService.log({
      company_id: data.company_id,
      user_id: userId,
      entity: "invoice",
      entity_id: invoice.id,
      action: "create",
    });

    const full = await this.invoiceRepository.findById(invoice.id, data.company_id);
    if (!full) {
      throw new AppError(404, "Invoice not found", "errors.invoiceNotFound");
    }
    return this.toInvoiceResponse(full);
  }

  async findById(id: string, companyId: string): Promise<InvoiceResponse> {
    const invoice = await this.invoiceRepository.findById(id, companyId);
    if (!invoice) {
      throw new AppError(404, "Invoice not found", "errors.invoiceNotFound");
    }
    return this.toInvoiceResponse(invoice);
  }

  async list(params: ListInvoicesParams): Promise<PaginatedResponse<InvoiceListItemResponse>> {
    const { companyId, page, limit, search, status, customer_id, start_date, end_date, sort, order } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.invoicesWhereInput = { company_id: companyId };

    if (search) {
      where.invoice_number = { contains: search, mode: "insensitive" };
    }
    if (status) {
      where.status = status;
    }
    if (customer_id) {
      where.customer_id = customer_id;
    }
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(`${start_date}T00:00:00.000Z`);
      }
      if (end_date) {
        where.created_at.lte = new Date(`${end_date}T23:59:59.999Z`);
      }
    }

    const orderBy = { [sort ?? "created_at"]: order ?? "desc" } as Prisma.invoicesOrderByWithRelationInput;
    const [invoices, total] = await Promise.all([
      this.invoiceRepository.findMany(where, skip, limit, orderBy),
      this.invoiceRepository.count(where),
    ]);

    return {
      data: invoices.map((inv) => this.toInvoiceListItemResponse(inv)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async addPayment(invoiceId: string, companyId: string, input: AddInvoicePaymentInput, userId: string): Promise<InvoiceResponse> {
    const invoice = await this.invoiceRepository.addPaymentTransactional(invoiceId, companyId, input);

    await this.activityLogService.log({
      company_id: companyId,
      user_id: userId,
      entity: "invoice",
      entity_id: invoiceId,
      action: "update",
      changes: { action: "payment_added", amount: input.amount },
    });

    return this.toInvoiceResponse(invoice);
  }

  async cancel(invoiceId: string, companyId: string, userId: string): Promise<InvoiceResponse> {
    const invoice = await this.invoiceRepository.cancelTransactional(invoiceId, companyId, userId);

    await this.activityLogService.log({
      company_id: companyId,
      user_id: userId,
      entity: "invoice",
      entity_id: invoiceId,
      action: "cancel",
      changes: { status: "canceled" },
    });

    return this.toInvoiceResponse(invoice);
  }
}
