import { invoice_status, payment_method } from "../../generated/prisma/client.js";

export interface CreateInvoiceItemInput {
  product_id: string;
  quantity: number;
  unit_price?: number;
}

export interface CreateInvoicePaymentInput {
  amount: number;
  method: payment_method;
  reference_number?: string;
  notes?: string;
}

export interface CreateInvoiceInput {
  company_id: string;
  customer_id?: string | null;
  discount_amount?: number;
  tax_amount?: number;
  due_date?: string | null;
  items: CreateInvoiceItemInput[];
  payment?: CreateInvoicePaymentInput;
}

export interface AddInvoicePaymentInput {
  amount: number;
  method: payment_method;
  reference_number?: string;
  notes?: string;
}

export interface ListInvoicesParams {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  status?: invoice_status | undefined;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  sort?: string;
  order?: "asc" | "desc" | undefined;
}
