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

export interface OpeningBalanceInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
}
