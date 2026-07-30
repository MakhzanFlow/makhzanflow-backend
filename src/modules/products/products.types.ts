export interface CreateProductInput {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  stock?: number;
  min_stock?: number;
  expiry_date?: string | null;
  is_active?: boolean;
  company_id: string;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number;
  stock?: number;
  min_stock?: number;
  expiry_date?: string | null;
  is_active?: boolean;
}

export interface ListProductParams {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: string;
  low_stock?: boolean;
  expiry_before?: string;
  expiry_after?: string;
  is_active?: boolean;
}
