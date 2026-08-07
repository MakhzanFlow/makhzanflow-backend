import "reflect-metadata";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import type { Response } from "express";
import { scopeTenant, type TenantRequest } from "../../../src/middleware/tenant.middleware.js";
import { prisma } from "../../../src/database/prisma.js";

let originalFindUnique: any;

function stubMembership(impl: (args: any) => Promise<any>) {
  prisma.company_members.findUnique = impl as any;
}

function makeContext() {
  const req = {
    headers: {},
    user: { id: "user-1" },
  } as TenantRequest;
  const res = {} as Response;
  const calledWith: any[] = [];
  const next = (err?: any) => {
    calledWith.push(err);
  };
  return { req, res, next, calledWith };
}

void describe("scopeTenant", () => {
  beforeEach(() => {
    originalFindUnique = prisma.company_members.findUnique.bind(prisma.company_members);
    stubMembership(async () => null);
  });

  afterEach(() => {
    prisma.company_members.findUnique = originalFindUnique;
  });

  void it("attaches companyId and role from the membership record", async () => {
    stubMembership(async () => ({
      role: "owner",
      permissions: { all: true },
    }));

    const { req, res, next, calledWith } = makeContext();
    req.headers["x-company-id"] = "company-1";

    await scopeTenant(req, res, next);

    assert.strictEqual(calledWith.length, 1);
    assert.strictEqual(calledWith[0], undefined);
    assert.strictEqual(req.companyId, "company-1");
    assert.strictEqual(req.role, "owner");
    assert.deepStrictEqual(req.permissions, { all: true });
  });

  void it("rejects a user who is not a member of the requested company", async () => {
    const { req, res, next, calledWith } = makeContext();
    req.headers["x-company-id"] = "company-1";

    await scopeTenant(req, res, next);

    assert.strictEqual(calledWith.length, 1);
    assert.strictEqual(calledWith[0]?.statusCode, 403);
    assert.strictEqual(calledWith[0]?.message, "You are not a member of this company");
  });

  void it("rejects requests without an x-company-id header", async () => {
    const { req, res, next, calledWith } = makeContext();

    await scopeTenant(req, res, next);

    assert.strictEqual(calledWith.length, 1);
    assert.strictEqual(calledWith[0]?.statusCode, 400);
  });

  void it("rejects requests without an authenticated user", async () => {
    const { req, res, next, calledWith } = makeContext();
    req.headers["x-company-id"] = "company-1";
    req.user = undefined;

    await scopeTenant(req, res, next);

    assert.strictEqual(calledWith.length, 1);
    assert.strictEqual(calledWith[0]?.statusCode, 401);
  });

  void it("passes through errors from the membership lookup", async () => {
    stubMembership(async () => {
      throw new Error("db down");
    });

    const { req, res, next, calledWith } = makeContext();
    req.headers["x-company-id"] = "company-1";

    await scopeTenant(req, res, next);

    assert.strictEqual(calledWith.length, 1);
    assert.strictEqual(calledWith[0]?.message, "db down");
  });
});
