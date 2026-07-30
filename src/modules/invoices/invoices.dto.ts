import { invoice_status } from "../../../generated/prisma/client.js";

export interface InvoiceItemProduct {
  name: string;
  image_url: string | null;
  price: number;
}

export interface InvoiceItemResponse {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products: InvoiceItemProduct;
}

export interface InvoicePaymentResponse {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: Date | null;
}

export interface InvoiceCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface InvoiceUser {
  id: string;
  name: string;
  email: string;
}

export interface InvoiceResponse {
  id: string;
  company_id: string;
  customer_id: string | null;
  user_id: string | null;
  invoice_number: string;
  status: invoice_status;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  due_date: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  invoice_items: InvoiceItemResponse[];
  payments: InvoicePaymentResponse[];
  customers: InvoiceCustomer | null;
  users: InvoiceUser | null;
}

export interface InvoiceListItemResponse {
  id: string;
  company_id: string;
  customer_id: string | null;
  user_id: string | null;
  invoice_number: string;
  status: invoice_status;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  due_date: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  customers: InvoiceCustomer | null;
  payments: InvoicePaymentResponse[];
  users: InvoiceUser | null;
}
