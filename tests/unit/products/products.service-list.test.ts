import "reflect-metadata";
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { ProductService } from "../../../src/modules/products/products.service.js";
import { ProductRepository } from "../../../src/modules/products/products.repository.js";
import { ActivityLogService } from "../../../src/modules/activity-logs/activity-logs.service.js";
import type { ICacheService } from "../../../src/shared/cache/cache.interface.js";

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

function makeStorageStub() {
  return {
    uploadBuffer: async () => "https://example.com/p.png",
    uploadBase64Maybe: async (v: string | null | undefined) => v ?? null,
  };
}

const companyId = "company-uuid";

const activeProduct = {
  id: "prod-active",
  company_id: companyId,
  name: "Milk",
  sku: "PRD-001",
  barcode: null,
  price: 10,
  stock: 100,
  min_stock: 10,
  image_url: null,
  expiry_date: null,
  is_active: true,
  created_at: new Date("2026-09-01"),
  updated_at: new Date("2026-09-01"),
};

const inactiveProduct = {
  ...activeProduct,
  id: "prod-inactive",
  name: "Old Cheese",
  sku: "PRD-002",
  is_active: false,
};

void describe("ProductService.list() is_active default", () => {
  let repo: ProductRepository;
  let service: ProductService;

  beforeEach(() => {
    repo = makeRepoStubs();
    service = new ProductService(repo, makeActivityLogStubs(), makeCacheStub(), makeStorageStub());
  });

  void it("returns ALL products (active + inactive) when is_active param is not given", async () => {
    let capturedWhere: Record<string, any> | undefined;
    (repo.findAll as any).mock.mockImplementation(async (where: Record<string, any>) => {
      capturedWhere = where;
      return [{ ...activeProduct }, { ...inactiveProduct }];
    });
    (repo.countAll as any).mock.mockImplementation(async () => 2);

    const result = await service.list({ companyId, page: 1, limit: 20 });

    assert.ok(capturedWhere && !("is_active" in capturedWhere));
    assert.strictEqual(result.data.length, 2);
    assert.deepStrictEqual(
      result.data.map((p) => p.is_active).sort(),
      [false, true]
    );
    assert.strictEqual(result.pagination.total, 2);
  });

  void it("filters by is_active when the param is given", async () => {
    let capturedWhere: Record<string, any> | undefined;
    (repo.findAll as any).mock.mockImplementation(async (where: Record<string, any>) => {
      capturedWhere = where;
      return [{ ...inactiveProduct }];
    });
    (repo.countAll as any).mock.mockImplementation(async () => 1);

    const result = await service.list({ companyId, page: 1, limit: 20, is_active: false });

    assert.strictEqual(capturedWhere?.is_active, false);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0]?.is_active, false);
  });
});
