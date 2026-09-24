import "reflect-metadata";
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { CompanyService } from "../../../src/modules/companies/company.service.js";
import { CompanyRepository } from "../../../src/modules/companies/company.repository.js";
import type { ICacheService } from "../../../src/shared/cache/cache.interface.js";
import { AppError } from "../../../src/shared/errors/app-error.js";

function makeRepoStubs(): InstanceType<typeof CompanyRepository> {
  const repo = new CompanyRepository();
  for (const key of Object.getOwnPropertyNames(CompanyRepository.prototype)) {
    if (key !== "constructor") {
      mock.method(repo, key as keyof CompanyRepository, async () => {});
    }
  }
  return repo;
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
    uploadBuffer: async () => "https://example.com/logo.png",
    uploadBase64Maybe: async (v: string | null | undefined) => v ?? null,
  };
}

const ownerUserId = "user-uuid";

const existingCompany = {
  id: "company-uuid",
  name: "Acme",
  logo_url: null,
  invite_code: "INV123",
  created_at: new Date("2026-09-01"),
  updated_at: new Date("2026-09-01"),
};

void describe("CompanyService.createCompany() duplicate-name handling", () => {
  let repo: CompanyRepository;
  let service: CompanyService;

  beforeEach(() => {
    repo = makeRepoStubs();
    service = new CompanyService(repo, makeCacheStub(), makeStorageStub() as any);
  });

  void it("tells the user they are already inside the company when they own that name", async () => {
    (repo.findCompaniesByUserId as any).mock.mockImplementation(async () => [{ ...existingCompany }]);

    await assert.rejects(service.createCompany({ name: "Acme" }, ownerUserId), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.strictEqual((err as AppError).statusCode, 409);
      assert.strictEqual((err as AppError).messageKey, "errors.alreadyInCompany");
      assert.match((err as Error).message, /already inside the company "Acme"/);
      return true;
    });
    assert.strictEqual((repo.createCompanyWithOwner as any).mock.callCount(), 0);
  });

  void it("allows the same name when the user has no company with that name", async () => {
    (repo.findCompaniesByUserId as any).mock.mockImplementation(async () => []);
    (repo.createCompanyWithOwner as any).mock.mockImplementation(async (data: any) => ({
      id: "new-uuid",
      ...data,
      created_at: new Date("2026-09-01"),
      updated_at: new Date("2026-09-01"),
    }));

    const company = await service.createCompany({ name: "Acme" }, ownerUserId);
    assert.strictEqual(company.name, "Acme");
    assert.strictEqual((repo.createCompanyWithOwner as any).mock.callCount(), 1);
  });
});
