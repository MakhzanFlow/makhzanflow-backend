export interface ProductResponse {
  id: string;
  company_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  min_stock: number;
  image_url: string | null;
  expiry_date: Date | null;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}
