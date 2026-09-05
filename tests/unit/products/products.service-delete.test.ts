import "reflect-metadata";
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { ProductService } from "../../../src/modules/products/products.service.js";
import { ProductRepository } from "../../../src/modules/products/products.repository.js";
import { ActivityLogService } from "../../../src/modules/activity-logs/activity-logs.service.js";
import type { ICacheService } from "../../../src/shared/cache/cache.interface.js";
import { AppError } from "../../../src/shared/errors/app-error.js";

function makeRepoStubs(): InstanceType<typeof ProductRepository> {
  const repo = new ProductRepository();
  for (const key of Object.getOwnPropertyNames(ProductRepository.prototype)) {
    if (key !== "constructor") {
      mock.method(repo, key as keyof ProductRepository, async () => {});
    }
  }
  return repo;
}

function makeActivityLogStubs(): InstanceType<typeof ActivityLogService> {
  const service = Object.create(ActivityLogService.prototype) as InstanceType<
    typeof ActivityLogService
  >;
  mock.method(service, "log", async () => ({}));
  return service;
}

function makeCacheStub(): ICacheService {
  return {
    get: async () => null,
    set: async () => {},
    del: async () => {},
    delPattern: async () => {},
  };
}

function makeRecordingCacheStub() {
  const calls: { op: "del" | "delPattern"; key: string }[] = [];
  const stub: ICacheService = {
    get: async () => null,
    set: async () => {},
    del: async (key: string) => {
      calls.push({ op: "del", key });
    },
    delPattern: async (pattern: string) => {
      calls.push({ op: "delPattern", key: pattern });
    },
  };
  return { stub, calls };
}

function assertThoroughInvalidation(calls: { op: string; key: string }[], id: string) {
  const keys = calls.map((c) => `${c.op}:${c.key}`);
  // Product caches
  assert.ok(keys.includes(`del:products:detail:${id}:${companyId}`));
  assert.ok(keys.includes(`delPattern:products:list:${companyId}:*`));
  assert.ok(keys.includes(`delPattern:products:low-stock:${companyId}:*`));
  // Invoice payloads embed product snapshots (name/price/image_url)
  assert.ok(keys.includes(`delPattern:invoices:list:${companyId}:*`));
  assert.ok(keys.includes(`delPattern:invoices:detail:*:${companyId}`));
  // Dashboard aggregates + activity feed (new log entry written)
  assert.ok(keys.includes(`del:dashboard:stats:${companyId}`));
  assert.ok(keys.includes(`delPattern:dashboard:low-stock:${companyId}:*`));
  assert.ok(keys.includes(`delPattern:dashboard:activity:${companyId}:*`));
}

const companyId = "company-uuid";
const userId = "user-uuid";

const baseProduct = {
  id: "prod-uuid-1",
  company_id: companyId,
  name: "Milk",
  sku: "PRD-001",
  barcode: null,
  price: { toString: () => "10.00" },
  stock: 100,
  min_stock: 10,
  image_url: null,
  expiry_date: null,
  is_active: true,
  created_at: new Date("2026-09-01"),
  updated_at: new Date("2026-09-01"),
};

void describe("ProductService.delete()", () => {
  let repo: ProductRepository;
  let service: ProductService;

  beforeEach(() => {
    repo = makeRepoStubs();
    service = new ProductService(repo, makeActivityLogStubs(), makeCacheStub());
  });

  void it("hard-deletes when the product has no invoice references", async () => {
    (repo.findById as any).mock.mockImplementation(async () => ({ ...baseProduct }));
    (repo.countInvoiceReferences as any).mock.mockImplementation(async () => 0);
    (repo.delete as any).mock.mockImplementation(async () => ({ ...baseProduct }));
    const { stub, calls } = makeRecordingCacheStub();
    service = new ProductService(repo, makeActivityLogStubs(), stub);

    const result = await service.delete(baseProduct.id, companyId, userId);

    assert.strictEqual(result.softDeleted, false);
    assert.strictEqual(result.product, undefined);
    assert.strictEqual((repo.delete as any).mock.callCount(), 1);
    assert.strictEqual((repo.softDelete as any).mock.callCount(), 0);
    assertThoroughInvalidation(calls, baseProduct.id);
  });

  void it("soft-deletes (is_active=false) when the product has invoice references", async () => {
    (repo.findById as any).mock.mockImplementation(async () => ({ ...baseProduct }));
    (repo.countInvoiceReferences as any).mock.mockImplementation(async () => 2);
    (repo.softDelete as any).mock.mockImplementation(async () => ({
      ...baseProduct,
      is_active: false,
    }));
    const { stub, calls } = makeRecordingCacheStub();
    service = new ProductService(repo, makeActivityLogStubs(), stub);

    const result = await service.delete(baseProduct.id, companyId, userId);

    assert.strictEqual(result.softDeleted, true);
    assert.strictEqual(result.product?.is_active, false);
    assert.strictEqual((repo.softDelete as any).mock.callCount(), 1);
    assert.strictEqual((repo.delete as any).mock.callCount(), 0);
    assertThoroughInvalidation(calls, baseProduct.id);
  });

  void it("is idempotent when an already-inactive referenced product is deleted again", async () => {
    (repo.findById as any).mock.mockImplementation(async () => ({
      ...baseProduct,
      is_active: false,
    }));
    (repo.countInvoiceReferences as any).mock.mockImplementation(async () => 1);

    const result = await service.delete(baseProduct.id, companyId, userId);

    assert.strictEqual(result.softDeleted, true);
    assert.strictEqual(result.product?.is_active, false);
    assert.strictEqual((repo.softDelete as any).mock.callCount(), 0);
    assert.strictEqual((repo.delete as any).mock.callCount(), 0);
  });

  void it("throws 404 when the product does not exist in the company", async () => {
    (repo.findById as any).mock.mockImplementation(async () => null);

    await assert.rejects(service.delete("missing-id", companyId, userId), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.strictEqual((err as AppError).statusCode, 404);
      return true;
    });
    assert.strictEqual((repo.delete as any).mock.callCount(), 0);
    assert.strictEqual((repo.softDelete as any).mock.callCount(), 0);
  });
});
