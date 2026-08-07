import "reflect-metadata";
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { DashboardService } from "../../../src/modules/dashboard/dashboard.service.js";
import { DashboardRepository } from "../../../src/modules/dashboard/dashboard.repository.js";

function makeRepoStubs(): InstanceType<typeof DashboardRepository> {
  const repo = new DashboardRepository();
  for (const key of Object.getOwnPropertyNames(DashboardRepository.prototype)) {
    if (key !== "constructor") {
      mock.method(repo, key as keyof DashboardRepository, async () => {});
    }
  }
  return repo;
}

const companyId = "company-uuid";

void describe("DashboardService", () => {
  let repo: DashboardRepository;
  let service: DashboardService;

  beforeEach(() => {
    repo = makeRepoStubs();
    service = new DashboardService(repo);
  });

  void describe("getStats()", () => {
    void it("returns all 7 stat fields with zero-filled weekly sales", async () => {
      (repo.countProducts as any).mock.mockImplementation(async () => 10);
      (repo.countCustomers as any).mock.mockImplementation(async () => 5);
      (repo.sumTotalDebt as any).mock.mockImplementation(async () => 500);
      (repo.sumPaymentsBetween as any).mock.mockImplementation(async () => 100);
      (repo.sumPaymentsSince as any).mock.mockImplementation(async () => 900);
      (repo.weeklySales as any).mock.mockImplementation(async () => [
        { day: new Date(Date.now() - 86400000), total: 250 },
      ]);
      (repo.recentActivities as any).mock.mockImplementation(async () => [
        {
          id: "log-1",
          user_id: "user-1",
          users: { name: "Hazem" },
          entity: "invoice",
          entity_id: "inv-1",
          action: "create",
          changes: null,
          created_at: new Date(),
        },
      ]);

      const stats = await service.getStats(companyId);

      assert.strictEqual(stats.productsCount, 10);
      assert.strictEqual(stats.customersCount, 5);
      assert.strictEqual(stats.totalDebt, 500);
      assert.strictEqual(stats.todaySales, 100);
      assert.strictEqual(stats.monthlyPayments, 900);
      assert.strictEqual(stats.weeklySales.length, 7);
      assert.strictEqual(stats.recentActivities.length, 1);
      assert.strictEqual(stats.recentActivities[0]?.user_name, "Hazem");
      assert.ok(stats.fetchedAt instanceof Date);
    });

    void it("fills missing weekdays with zero", async () => {
      (repo.weeklySales as any).mock.mockImplementation(async () => []);
      (repo.recentActivities as any).mock.mockImplementation(async () => []);

      const stats = await service.getStats(companyId);

      assert.strictEqual(stats.weeklySales.length, 7);
      for (const point of stats.weeklySales) {
        assert.strictEqual(point.amount, 0);
        assert.match(point.date, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(point.label.length > 0);
      }
    });
  });

  void describe("getLowStock()", () => {
    void it("returns paginated low-stock products", async () => {
      (repo.findLowStock as any).mock.mockImplementation(async () => [
        { id: "p1", name: "Milk", sku: "SKU1", barcode: null, price: { toString: () => "10" }, stock: 2, min_stock: 5, image_url: null },
      ]);
      (repo.countLowStock as any).mock.mockImplementation(async () => 1);

      const result = await service.getLowStock({ companyId, page: 1, limit: 20 });

      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.data[0]?.name, "Milk");
      assert.strictEqual(result.pagination.total, 1);
      assert.strictEqual(result.pagination.pages, 1);
    });
  });

  void describe("getMonthlyReport()", () => {
    void it("defaults to last 12 months when no range is passed", async () => {
      (repo.monthlyInvoices as any).mock.mockImplementation(async () => []);
      (repo.monthlyPayments as any).mock.mockImplementation(async () => []);

      const report = await service.getMonthlyReport({ companyId });

      assert.strictEqual(report.length, 12);
      const now = new Date();
      const last = report[report.length - 1];
      assert.strictEqual(last?.month, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
      const first = report[0];
      assert.ok(first && first.month < last!.month);
    });

    void it("zero-fills months without data", async () => {
      (repo.monthlyInvoices as any).mock.mockImplementation(async () => [
        { month: "2026-07", count: 3, revenue: 1500 },
      ]);
      (repo.monthlyPayments as any).mock.mockImplementation(async () => [
        { month: "2026-07", total: 1200 },
      ]);

      const report = await service.getMonthlyReport({ companyId, from: "2026-06", to: "2026-08" });

      assert.strictEqual(report.length, 3);
      assert.strictEqual(report[0]?.month, "2026-06");
      assert.strictEqual(report[1]?.month, "2026-07");
      assert.strictEqual(report[2]?.month, "2026-08");
      const july = report.find((r) => r.month === "2026-07");
      assert.strictEqual(july?.totalInvoices, 3);
      assert.strictEqual(july?.totalRevenue, 1500);
      assert.strictEqual(july?.totalPayments, 1200);
      const empty = report.find((r) => r.month !== "2026-07");
      assert.strictEqual(empty?.totalInvoices, 0);
    });

    void it("extends a range to the current month when only from is passed", async () => {
      (repo.monthlyInvoices as any).mock.mockImplementation(async () => []);
      (repo.monthlyPayments as any).mock.mockImplementation(async () => []);

      const report = await service.getMonthlyReport({ companyId, from: "2026-01" });

      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      assert.strictEqual(report[0]?.month, "2026-01");
      assert.strictEqual(report[report.length - 1]?.month, currentKey);
    });

    void it("starts 12 months before to when only to is passed", async () => {
      (repo.monthlyInvoices as any).mock.mockImplementation(async () => []);
      (repo.monthlyPayments as any).mock.mockImplementation(async () => []);

      const report = await service.getMonthlyReport({ companyId, to: "2026-12" });

      assert.strictEqual(report.length, 12);
      assert.strictEqual(report[0]?.month, "2026-01");
      assert.strictEqual(report[report.length - 1]?.month, "2026-12");
    });

    void it("rejects ranges longer than 24 months", async () => {
      await assert.rejects(
        service.getMonthlyReport({ companyId, from: "2024-01", to: "2026-08" }),
        (err: Error) => (err as any).statusCode === 400
      );
    });

    void it("rejects an inverted range (from after to)", async () => {
      await assert.rejects(
        service.getMonthlyReport({ companyId, from: "2026-09", to: "2026-07" }),
        (err: Error) => (err as any).statusCode === 400
      );
    });
  });

  void describe("getActivity()", () => {
    void it("returns paginated activity with user names", async () => {
      (repo.listActivity as any).mock.mockImplementation(async () => [
        {
          id: "log-1",
          user_id: "user-1",
          users: { name: "Hazem" },
          entity: "product",
          entity_id: "p1",
          action: "create",
          changes: { name: "Milk" },
          created_at: new Date(),
        },
      ]);
      (repo.countActivity as any).mock.mockImplementation(async () => 1);

      const result = await service.getActivity({ companyId, page: 1, limit: 20 });

      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.data[0]?.user_name, "Hazem");
      assert.strictEqual(result.data[0]?.changes?.name, "Milk");
      assert.strictEqual(result.pagination.total, 1);
    });
  });
});
