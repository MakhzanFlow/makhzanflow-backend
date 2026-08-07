import { injectable, inject } from "tsyringe";
import { DashboardRepository } from "./dashboard.repository.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  DashboardStats,
  LowStockParams,
  LowStockProduct,
  MonthlyReportEntry,
  MonthlyReportParams,
  ActivityParams,
  RecentActivity,
  WeeklySalesPoint,
} from "./dashboard.types.js";
import type { PaginatedResponse } from "../../shared/types/shared.dto.js";

interface YearMonth {
  year: number;
  month: number;
}

function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const total = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function parseMonth(value: string): YearMonth {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) {
    throw new AppError(400, `Invalid month format: "${value}". Expected YYYY-MM`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new AppError(400, `Invalid month: ${month}. Must be between 01 and 12`);
  }
  return { year, month };
}

@injectable()
export class DashboardService {
  constructor(
    @inject(DashboardRepository) private dashboardRepository: DashboardRepository
  ) {}

  private readonly arabicDayLabels: Record<string, string> = {
    "0": "أحد", "1": "اثن", "2": "ثلا", "3": "أرب",
    "4": "خمي", "5": "جمعة", "6": "سبت",
  };

  async getStats(companyId: string): Promise<DashboardStats> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const [
      productsCount,
      customersCount,
      totalDebt,
      todaySales,
      monthlyPayments,
      weeklySalesRows,
      recentActivities,
    ] = await Promise.all([
      this.dashboardRepository.countProducts(companyId),
      this.dashboardRepository.countCustomers(companyId),
      this.dashboardRepository.sumTotalDebt(companyId),
      this.dashboardRepository.sumPaymentsBetween(companyId, startOfDay, endOfDay),
      this.dashboardRepository.sumPaymentsSince(companyId, startOfMonth),
      this.dashboardRepository.weeklySales(companyId, sevenDaysAgo),
      this.dashboardRepository.recentActivities(companyId, sevenDaysAgo, 5),
    ]);

    const weeklySalesMap = new Map<string, number>();
    for (const row of weeklySalesRows) {
      const key = new Date(row.day).toISOString().split("T")[0] ?? "";
      weeklySalesMap.set(key, Number(row.total));
    }

    const weeklySales: WeeklySalesPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split("T")[0] ?? "";
      weeklySales.push({
        date: key,
        label: this.arabicDayLabels[d.getDay().toString()] ?? "",
        amount: weeklySalesMap.get(key) ?? 0,
      });
    }

    return {
      productsCount,
      customersCount,
      totalDebt,
      todaySales,
      monthlyPayments,
      weeklySales,
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        user_name: a.users.name,
        entity: a.entity,
        entity_id: a.entity_id,
        action: a.action,
        changes: a.changes as Record<string, any> | null,
        created_at: a.created_at,
      })),
      fetchedAt: now,
    };
  }

  async getLowStock(params: LowStockParams): Promise<PaginatedResponse<LowStockProduct>> {
    const skip = (params.page - 1) * params.limit;

    const [rows, total] = await Promise.all([
      this.dashboardRepository.findLowStock(
        params.companyId,
        skip,
        params.limit,
        params.sort ?? "name",
        params.order ?? "asc",
        params.search
      ),
      this.dashboardRepository.countLowStock(params.companyId, params.search),
    ]);

    return {
      data: rows.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        barcode: p.barcode ?? null,
        price: Number(p.price),
        stock: p.stock,
        min_stock: p.min_stock,
        image_url: p.image_url ?? null,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        pages: Math.ceil(total / params.limit),
      },
    };
  }

  async getMonthlyReport(params: MonthlyReportParams): Promise<MonthlyReportEntry[]> {
    const { companyId, months = 12, from, to } = params;

    const now = new Date();
    const currentMonth: YearMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };

    let startYM: YearMonth;
    let endYM: YearMonth;

    if (from || to) {
      const fromYM = from ? parseMonth(from) : null;
      const toYM = to ? parseMonth(to) : null;
      endYM = toYM ?? currentMonth;
      startYM = fromYM ?? shiftMonth(endYM, -(months - 1));

      const monthCount = (endYM.year - startYM.year) * 12 + (endYM.month - startYM.month) + 1;
      if (monthCount > 24) {
        throw new AppError(400, "Dashboard report range cannot exceed 24 months");
      }
      if (monthCount < 1) {
        throw new AppError(400, "Dashboard report range is invalid: 'from' must be before or equal to 'to'");
      }
    } else {
      endYM = currentMonth;
      startYM = shiftMonth(endYM, -(months - 1));
    }

    return this.buildMonthlyReport(companyId, startYM, endYM);
  }

  private async buildMonthlyReport(
    companyId: string,
    startYM: YearMonth,
    endYM: YearMonth
  ): Promise<MonthlyReportEntry[]> {
    const start = new Date(Date.UTC(startYM.year, startYM.month - 1, 1));
    const end = new Date(Date.UTC(endYM.year, endYM.month, 1));

    const [invoiceRows, paymentRows] = await Promise.all([
      this.dashboardRepository.monthlyInvoices(companyId, start, end),
      this.dashboardRepository.monthlyPayments(companyId, start, end),
    ]);

    const invoicesMap = new Map(invoiceRows.map((r) => [r.month, r]));
    const paymentsMap = new Map(paymentRows.map((r) => [r.month, Number(r.total)]));

    const result: MonthlyReportEntry[] = [];
    let cursor = startYM;
    while (
      cursor.year < endYM.year ||
      (cursor.year === endYM.year && cursor.month <= endYM.month)
    ) {
      const key = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
      const inv = invoicesMap.get(key);
      result.push({
        month: key,
        totalInvoices: Number(inv?.count ?? 0),
        totalRevenue: Number(inv?.revenue ?? 0),
        totalPayments: paymentsMap.get(key) ?? 0,
      });
      cursor = shiftMonth(cursor, 1);
    }
    return result;
  }

  async getActivity(params: ActivityParams): Promise<PaginatedResponse<RecentActivity>> {
    const skip = (params.page - 1) * params.limit;

    const [logs, total] = await Promise.all([
      this.dashboardRepository.listActivity(params.companyId, skip, params.limit),
      this.dashboardRepository.countActivity(params.companyId),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        user_id: log.user_id,
        user_name: log.users.name,
        entity: log.entity,
        entity_id: log.entity_id,
        action: log.action,
        changes: log.changes as Record<string, any> | null,
        created_at: log.created_at,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        pages: Math.ceil(total / params.limit),
      },
    };
  }
}
