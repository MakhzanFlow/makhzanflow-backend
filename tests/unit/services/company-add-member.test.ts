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

void describe("CompanyService.addMember() role guards", () => {
  let repo: CompanyRepository;
  let service: CompanyService;

  beforeEach(() => {
    repo = makeRepoStubs();
    service = new CompanyService(repo, makeCacheStub(), makeStorageStub() as any);
  });

  void it("blocks admins from granting the owner role", async () => {
    (repo.findMember as any).mock.mockImplementation(async (_companyId: string, userId: string) =>
      userId === "admin-id" ? { role: "admin", permissions: {} } : null
    );

    await assert.rejects(
      service.addMember("company-id", "victim-id", "owner" as any, {}, "admin-id"),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual((err as AppError).statusCode, 403);
        return true;
      }
    );
    assert.strictEqual((repo.addMember as any).mock.callCount(), 0);
  });

  void it("blocks admins from granting the admin role", async () => {
    (repo.findMember as any).mock.mockImplementation(async (_companyId: string, userId: string) =>
      userId === "admin-id" ? { role: "admin", permissions: {} } : null
    );

    await assert.rejects(
      service.addMember("company-id", "victim-id", "admin" as any, {}, "admin-id"),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual((err as AppError).statusCode, 403);
        return true;
      }
    );
    assert.strictEqual((repo.addMember as any).mock.callCount(), 0);
  });

  void it("lets owners grant the owner role", async () => {
    (repo.findMember as any).mock.mockImplementation(async (_companyId: string, userId: string) =>
      userId === "owner-id" ? { role: "owner", permissions: { all: true } } : null
    );
    (repo.addMember as any).mock.mockImplementation(async () => ({ role: "owner" }));

    const member = await service.addMember("company-id", "victim-id", "owner" as any, {}, "owner-id");
    assert.strictEqual((member as any).role, "owner");
  });
});
