export interface CustomerResponse {
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

export interface CustomerCreatedResponse extends CustomerResponse {
  opening_balance_invoice?: {
    id: string;
    invoice_number: string;
    total_amount: number;
    status: string;
  };
}

export interface CustomerDetailResponse extends CustomerResponse {
  recent_transactions: CustomerTransactionItem[];
}

export interface CustomerTransactionItem {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  due_date: Date | null;
  created_at: Date | null;
}

export interface CustomerSummaryResponse {
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

export interface CustomerInvoiceItem {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  due_date: Date | null;
  created_at: Date | null;
}

export interface CustomerPaymentItem {
  id: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: Date | null;
}

export interface DebtBreakdownItem {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  due: number;
}

export interface CustomerDebtResponse {
  customer_id: string;
  customer_name: string;
  opening_balance: number;
  total_invoice_amount: number;
  total_paid: number;
  current_debt: number;
  breakdown: DebtBreakdownItem[];
  recent_payments: CustomerPaymentItem[];
}
