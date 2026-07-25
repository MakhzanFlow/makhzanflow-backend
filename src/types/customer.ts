export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  opening_balance?: number;
  company_id: string;
}

export interface UpdateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ListCustomerParams {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: string;
  debt_status?: string;
}

export interface DebtorsParams {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
}

export interface DebtBreakdownItem {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  due: number;
}

export interface CustomerDebt {
  customer_id: string;
  customer_name: string;
  opening_balance: number;
  total_invoice_amount: number;
  total_paid: number;
  current_debt: number;
  breakdown: DebtBreakdownItem[];
}

export interface CustomerTransaction {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  due_date: Date | null;
  created_at: Date | null;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  image_url: string | null;
  current_debt: number;
  created_at: Date | null;
  updated_at: Date | null;
  recent_transactions: CustomerTransaction[];
}

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  image_url: string | null;
  current_debt: number;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface CustomerSummary {
  total: number;
  with_debt: number;
  zero_debt: number;
  credit_balance: number;
}

export interface CustomerDebtorItem {
  id: string;
  name: string;
  phone: string | null;
  opening_balance: number;
  current_debt: number;
  last_invoice_date: Date | null;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface OpeningBalanceInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
}

export interface CreatedCustomerResponse {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  image_url: string | null;
  current_debt: number;
  created_at: Date | null;
  updated_at: Date | null;
  opening_balance_invoice?: OpeningBalanceInvoice;
}

export interface ImageUploadResult {
  image_url: string;
}
