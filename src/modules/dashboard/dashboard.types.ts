export interface WeeklySalesPoint {
  date: string;
  label: string;
  amount: number;
}

export interface RecentActivity {
  id: string;
  user_id: string;
  user_name: string;
  entity: string;
  entity_id: string | null;
  action: string;
  changes: Record<string, any> | null;
  created_at: Date | null;
}

export interface DashboardStats {
  productsCount: number;
  customersCount: number;
  totalDebt: number;
  todaySales: number;
  monthlyPayments: number;
  weeklySales: WeeklySalesPoint[];
  recentActivities: RecentActivity[];
  fetchedAt: Date;
}

export interface LowStockParams {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  min_stock: number;
  image_url: string | null;
}

export interface MonthlyReportEntry {
  month: string;
  totalInvoices: number;
  totalRevenue: number;
  totalPayments: number;
}

export interface MonthlyReportParams {
  companyId: string;
  months?: number;
  from?: string;
  to?: string;
}

export interface ActivityParams {
  companyId: string;
  page: number;
  limit: number;
}
