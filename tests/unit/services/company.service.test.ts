import "reflect-metadata";
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { CompanyService } from "../../../src/modules/companies/company.service.js";
import { CompanyRepository } from "../../../src/modules/companies/company.repository.js";
import { PERMISSION_GROUPS } from "../../../src/shared/constants/permissions.js";

function makeRepoStubs(): InstanceType<typeof CompanyRepository> {
  const repo = new CompanyRepository();
  for (const key of Object.getOwnPropertyNames(CompanyRepository.prototype)) {
    if (key !== "constructor") {
      mock.method(repo, key as keyof CompanyRepository, async () => {});
    }
  }
  return repo;
}

const companyId = "company-uuid";

void describe("CompanyService", () => {
  let repo: CompanyRepository;
  let service: CompanyService;

  beforeEach(() => {
    repo = makeRepoStubs();
    service = new CompanyService(repo);
  });

  void describe("getPermissionCatalog()", () => {
    void it("returns every group with its permission keys, labels and descriptions", () => {
      const catalog = service.getPermissionCatalog();

      const groupKeys = Object.keys(PERMISSION_GROUPS);
      assert.strictEqual(catalog.groups.length, groupKeys.length);

      const flat = catalog.groups.flatMap((g) => g.permissions);
      const catalogKeys = groupKeys.flatMap((g) =>
        Object.keys(PERMISSION_GROUPS[g as keyof typeof PERMISSION_GROUPS].permissions).map(
          (a) => `${g}.${a}`
        )
      );
      assert.strictEqual(flat.length, catalogKeys.length);
      assert.deepStrictEqual(flat.map((p) => p.key), catalogKeys);

      const products = catalog.groups.find((g) => g.key === "products");
      assert.ok(products);
      assert.strictEqual(products.label, "Products");
      assert.ok(products.permissions.some((p) => p.key === "products.create"));
      assert.ok(products.permissions[0] && products.permissions[0].description.length > 0);
    });
  });

  void describe("getMemberPermissions()", () => {
    void it("returns the member role and flattened permission keys", async () => {
      (repo.findMember as any).mock.mockImplementation(async (companyId: string, userId: string) => {
        if (userId === "operator-1") return { role: "owner", permissions: { all: true } };
        return {
          role: "member",
          permissions: { products: { read: true, create: true }, invoices: { read: true } },
        };
      });

      const result = await service.getMemberPermissions(companyId, "target-1", "operator-1");

      assert.strictEqual(result.role, "member");
      assert.deepStrictEqual(result.permissions, ["products.read", "products.create", "invoices.read"]);
    });

    void it("returns an empty list for a member without permissions", async () => {
      (repo.findMember as any).mock.mockImplementation(async () => ({
        role: "member",
        permissions: {},
      }));

      const result = await service.getMemberPermissions(companyId, "operator-1", "operator-1");

      assert.deepStrictEqual(result.permissions, []);
    });

    void it("returns every permission key for owners and admins", async () => {
      (repo.findMember as any).mock.mockImplementation(async () => ({
        role: "admin",
        permissions: {},
      }));

      const result = await service.getMemberPermissions(companyId, "target-1", "operator-1");

      const catalogKeys = Object.entries(PERMISSION_GROUPS).flatMap(([g, def]) =>
        Object.keys(def.permissions).map((a) => `${g}.${a}`)
      );
      assert.strictEqual(result.role, "admin");
      assert.deepStrictEqual(result.permissions, catalogKeys);
    });

    void it("rejects operators who are not members of the company", async () => {
      (repo.findMember as any).mock.mockImplementation(async () => null);

      await assert.rejects(
        service.getMemberPermissions(companyId, "target-1", "operator-1"),
        (err: Error) => (err as any).statusCode === 403
      );
    });

    void it("rejects when the target member does not exist", async () => {
      (repo.findMember as any).mock.mockImplementation(async (companyId: string, userId: string) => {
        if (userId === "operator-1") return { role: "owner", permissions: { all: true } };
        return null;
      });

      await assert.rejects(
        service.getMemberPermissions(companyId, "target-1", "operator-1"),
        (err: Error) => (err as any).statusCode === 404
      );
    });
  });
});
