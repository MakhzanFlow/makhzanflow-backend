export interface CreateProductInput {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  cost?: number;
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
  cost?: number;
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

export interface ProductResponse {
  id: string;
  company_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  image_url: string | null;
  expiry_date: Date | null;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
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
