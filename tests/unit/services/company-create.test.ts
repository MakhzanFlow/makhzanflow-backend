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
    service = new CompanyService(repo, makeCacheStub());
  });

  void it("tells the user they are already inside the company when they are a member of it", async () => {
    (repo.findByName as any).mock.mockImplementation(async () => ({ ...existingCompany }));
    (repo.findMember as any).mock.mockImplementation(async () => ({ role: "owner" }));

    await assert.rejects(service.createCompany({ name: "Acme" }, ownerUserId), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.strictEqual((err as AppError).statusCode, 409);
      assert.strictEqual((err as AppError).messageKey, "errors.alreadyInCompany");
      assert.match((err as Error).message, /already inside the company "Acme"/);
      return true;
    });
    assert.strictEqual((repo.createCompanyWithOwner as any).mock.callCount(), 0);
  });

  void it("keeps the generic already-exists error when the user is not a member of that company", async () => {
    (repo.findByName as any).mock.mockImplementation(async () => ({ ...existingCompany }));
    (repo.findMember as any).mock.mockImplementation(async () => null);

    await assert.rejects(service.createCompany({ name: "Acme" }, ownerUserId), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.strictEqual((err as AppError).statusCode, 409);
      assert.strictEqual((err as AppError).messageKey, "errors.companyExists");
      return true;
    });
    assert.strictEqual((repo.createCompanyWithOwner as any).mock.callCount(), 0);
  });
});
