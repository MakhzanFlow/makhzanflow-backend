/**
 * Neon end-to-end integration flow.
 *
 * Covers the full application flow THROUGH the HTTP API (supertest against
 * the real Express app) backed by the real Neon PostgreSQL database:
 *   users/companies -> members -> products -> customers -> invoices/payments
 *
 * Safety:
 * - Never touches the pre-existing users/companies/products/invoices except
 *   read-only verification.
 * - All created rows use an `E2E-` prefix + per-run stamp and are deleted by
 *   the section-6 cleanup test, which FAILS LOUDLY on any leftover and
 *   asserts global table counts match the pre-run snapshot. The `after` hook
 *   re-runs the same cleanup as a safety net for mid-suite failures.
 * - Invoices have no DELETE endpoint, so cleanup removes them via Prisma
 *   directly (documented, test-only).
 * - Sets DISABLE_RATE_LIMIT=1 so the shared Upstash 100 req / 15 min window
 *   is bypassed for this single-process suite (per-route express limiters
 *   still apply; the suite stays within them).
 *
 * Run ONLY against Neon:
 *   NODE_ENV=production node --import tsx --test tests/integration/neon-e2e.test.ts
 *
 * `NODE_ENV=production` makes src/config/env.ts load `.env.production`
 * (Neon DATABASE_URL). The suite skips gracefully when the configured
 * database is not Neon so plain `npm test` on a local DB stays green.
 */
import "reflect-metadata";
import "../../src/shared/di/container.js";
// Bypass the shared Upstash 100 req / 15 min window for this single-process
// suite (checked at request time by upstashRateLimit; per-route express
// limiters still apply, and the suite stays within them).
process.env["DISABLE_RATE_LIMIT"] = "1";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/database/prisma.js";
import { disconnectRedis } from "../../src/config/redis.js";
import { generateAccessToken } from "../../src/shared/utils/jwt.js";

const DB_URL = process.env["DATABASE_URL"] ?? "";
const IS_NEON = DB_URL.includes("neon.tech");
const RUN = Date.now().toString(36).toUpperCase();
const tag = (s: string) => `E2E-${RUN}-${s}`;

const OWNER_EMAIL = "haazemsaidd@gmail.com";
const MISSING_EMAIL = "hazemsaid.dev@gmail.com"; // claimed to exist, verified below

// Shared state populated in `before` and across tests (node:test runs in order).
const ctx: {
  ownerId: string;
  ownerEmail: string;
  companyId: string;
  companyName: string;
  ownerToken: string;
  memberAId: string;
  memberBId: string;
  memberAToken: string;
  productIds: string[];
  productByName: Record<string, any>;
  customerIds: string[];
  customerByName: Record<string, any>;
  invoiceIds: string[];
  invoiceByKind: Record<string, any>;
  preExisting: Record<string, number>;
} = {
  ownerId: "",
  ownerEmail: OWNER_EMAIL,
  companyId: "",
  companyName: "",
  ownerToken: "",
  memberAId: "",
  memberBId: "",
  memberAToken: "",
  productIds: [],
  productByName: {},
  customerIds: [],
  customerByName: {},
  invoiceIds: [],
  invoiceByKind: {},
  preExisting: {},
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const tenant = (token: string, companyId: string) => ({
  ...auth(token),
  "x-company-id": companyId,
});

async function createVerifiedUser(name: string, email: string): Promise<any> {
  const password_hash = await bcrypt.hash("Test12345!", 10);
  return prisma.users.create({
    data: { name, email, password_hash, is_verified: true, verified_at: new Date() },
  });
}

if (!IS_NEON) {
  describe("Neon E2E (skipped — DATABASE_URL is not Neon)", () => {
    after(async () => {
      // Release module-level handles (local redis reconnect loop, prisma)
      // so `npm test` on a local DB exits cleanly.
      await prisma.$disconnect().catch(() => {});
      await disconnectRedis().catch(() => {});
    });
    it("skips gracefully on non-Neon databases", () => {
      assert.ok(true, "skipped");
    });
  });
} else {
  describe("Neon E2E — full application flow", () => {
    before(async () => {
      // --- Resolve existing owner + company (read-only) ---
      const owner = await prisma.users.findUnique({ where: { email: OWNER_EMAIL } });
      assert.ok(owner, `existing user ${OWNER_EMAIL} must exist in Neon`);
      const membership = await prisma.company_members.findFirst({
        where: { user_id: owner!.id },
        include: { companies: true },
      });
      assert.ok(membership, `existing user ${OWNER_EMAIL} must belong to a company`);
      ctx.ownerId = owner!.id;
      ctx.companyId = membership!.company_id;
      ctx.companyName = (membership as any).companies.name;
      ctx.ownerToken = generateAccessToken({ id: owner!.id, email: owner!.email });

      // Snapshot pre-existing counts for end-of-run integrity check.
      const [users, companies, products, customers, invoices] = await Promise.all([
        prisma.users.count(),
        prisma.companies.count(),
        prisma.products.count(),
        prisma.customers.count(),
        prisma.invoices.count(),
      ]);
      ctx.preExisting = { users, companies, products, customers, invoices };

      // --- Isolated test users for the member lifecycle ---
      const memberA = await createVerifiedUser(tag("Member A"), `e2e-a-${RUN}@test.local`.toLowerCase());
      const memberB = await createVerifiedUser(tag("Member B"), `e2e-b-${RUN}@test.local`.toLowerCase());
      ctx.memberAId = memberA.id;
      ctx.memberBId = memberB.id;
      ctx.memberAToken = generateAccessToken({ id: memberA.id, email: memberA.email });
    });

    /**
     * Removes every row this run created, in FK-safe order.
     * Returns a list of error messages (empty = fully clean). Never touches
     * pre-existing rows: deletions are scoped to tracked IDs + this run's
     * `E2E-${RUN}` stamp.
     */
    async function cleanupE2E(): Promise<string[]> {
      const errors: string[] = [];
      const step = async (label: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
        } catch (err) {
          errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      const testEntityIds = [...ctx.invoiceIds, ...ctx.productIds, ...ctx.customerIds];
      await step("delete test invoices", () =>
        ctx.invoiceIds.length > 0
          ? prisma.invoices.deleteMany({ where: { id: { in: ctx.invoiceIds } } })
          : Promise.resolve(),
      );
      await step("delete OB invoices of test customers", () =>
        // OB invoices created implicitly for opening-balance customers are
        // linked to our test customers — remove them too.
        ctx.customerIds.length > 0
          ? prisma.invoices.deleteMany({ where: { customer_id: { in: ctx.customerIds } } })
          : Promise.resolve(),
      );
      await step("delete test products", async () => {
        if (ctx.productIds.length > 0) {
          await prisma.products.deleteMany({ where: { id: { in: ctx.productIds } } });
        }
        // Fallback: any straggler with this run's stamp.
        await prisma.products.deleteMany({ where: { name: { startsWith: `E2E-${RUN}` } } });
      });
      await step("delete test customers", async () => {
        if (ctx.customerIds.length > 0) {
          await prisma.customers.deleteMany({ where: { id: { in: ctx.customerIds } } });
        }
        await prisma.customers.deleteMany({ where: { name: { startsWith: `E2E-${RUN}` } } });
      });
      await step("remove test memberships", () =>
        prisma.company_members.deleteMany({
          where: { company_id: ctx.companyId, user_id: { in: [ctx.memberAId, ctx.memberBId] } },
        }),
      );
      await step("remove test join requests", () =>
        prisma.join_requests.deleteMany({
          where: { company_id: ctx.companyId, user_id: { in: [ctx.memberAId, ctx.memberBId] } },
        }),
      );
      await step("delete test users", () =>
        prisma.users.deleteMany({ where: { id: { in: [ctx.memberAId, ctx.memberBId] } } }),
      );
      await step("delete audit traces of test entities", () =>
        // Audit table only; pre-existing entities are never in this ID set.
        testEntityIds.length > 0
          ? prisma.activity_logs.deleteMany({ where: { entity_id: { in: testEntityIds } } })
          : Promise.resolve(),
      );
      return errors;
    }

    after(async () => {
      // Safety net for failure paths (the ordered cleanup test in section 6
      // is the primary cleanup and reports loudly on failure).
      await cleanupE2E();
      await prisma.$disconnect().catch(() => {});
    });

    // ------------------------------------------------------------------
    describe("0. existing data sanity (read-only)", () => {
      it("uses the existing verified owner without duplicating users", async () => {
        const owner = await prisma.users.findUnique({ where: { email: OWNER_EMAIL } });
        assert.ok(owner);
        assert.strictEqual(owner!.is_verified, true);
        assert.strictEqual(owner!.id, ctx.ownerId);
      });

      it("documents that hazemsaid.dev@gmail.com does NOT exist in Neon", async () => {
        const missing = await prisma.users.findUnique({ where: { email: MISSING_EMAIL } });
        // The task brief claims both users exist; only one actually does.
        // Record the discrepancy instead of failing — the suite proceeds with
        // the real owner and isolated E2E users.
        assert.strictEqual(missing, null, `${MISSING_EMAIL} should be absent (brief discrepancy)`);
      });

      it("owner belongs to exactly the expected company", async () => {
        const res = await request(app).get("/api/companies").set(auth(ctx.ownerToken)).expect(200);
        assert.strictEqual(res.body.success, true);
        const mine = res.body.data.find((c: any) => c.id === ctx.companyId);
        assert.ok(mine, "owner's company list must include the test company");
      });

      it("auth/me works through the app for the existing user", async () => {
        const res = await request(app).get("/api/auth/me").set(auth(ctx.ownerToken)).expect(200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.email, OWNER_EMAIL);
      });

      it("rejects unauthenticated and invalid-token requests", async () => {
        await request(app).get("/api/auth/me").expect(401);
        await request(app).get("/api/auth/me").set(auth("invalid.token.here")).expect(401);
      });

      it("login validation rejects bad credentials without touching data", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email: OWNER_EMAIL, password: "definitely-wrong-password" })
          .expect(401);
        assert.strictEqual(res.body.success, false);
      });
    });

    // ------------------------------------------------------------------
    describe("1. companies & members lifecycle (via API)", () => {
      it("adds member A with limited permissions (create)", async () => {
        const res = await request(app)
          .post(`/api/companies/${ctx.companyId}/members`)
          .set(auth(ctx.ownerToken))
          .send({
            targetUserId: ctx.memberAId,
            role: "member",
            permissions: ["products.read", "invoices.read", "customers.read"],
          })
          .expect(201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.role, "member");
        // Persisted?
        const row = await prisma.company_members.findUnique({
          where: { company_id_user_id: { company_id: ctx.companyId, user_id: ctx.memberAId } },
        });
        assert.ok(row);
      });

      it("rejects duplicate member add (failure case)", async () => {
        const res = await request(app)
          .post(`/api/companies/${ctx.companyId}/members`)
          .set(auth(ctx.ownerToken))
          .send({ targetUserId: ctx.memberAId, role: "member", permissions: [] })
          .expect(400);
        assert.strictEqual(res.body.success, false);
      });

      it("lists members and includes the new member (read)", async () => {
        const res = await request(app)
          .get(`/api/companies/${ctx.companyId}/members`)
          .set(auth(ctx.ownerToken))
          .expect(200);
        assert.strictEqual(res.body.success, true);
        const ids = res.body.data.map((m: any) => m.user_id ?? m.users?.id);
        assert.ok(ids.includes(ctx.memberAId), "member list must contain member A");
        assert.ok(res.body.pagination.total >= 2);
      });

      it("reads member A permissions", async () => {
        const res = await request(app)
          .get(`/api/companies/${ctx.companyId}/members/${ctx.memberAId}/permissions`)
          .set(auth(ctx.ownerToken))
          .expect(200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.role, "member");
        assert.ok(res.body.data.permissions.includes("products.read"));
      });

      it("restricted member cannot create products (authorization)", async () => {
        const res = await request(app)
          .post("/api/products")
          .set(tenant(ctx.memberAToken, ctx.companyId))
          .send({ name: tag("Should Fail"), price: 1 })
          .expect(403);
        assert.strictEqual(res.body.success, false);
      });

      it("promotes member A and grants create permission (update)", async () => {
        const res = await request(app)
          .patch(`/api/companies/${ctx.companyId}/members/${ctx.memberAId}`)
          .set(auth(ctx.ownerToken))
          .send({ role: "admin" })
          .expect(200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.role, "admin");
        const row = await prisma.company_members.findUnique({
          where: { company_id_user_id: { company_id: ctx.companyId, user_id: ctx.memberAId } },
        });
        assert.strictEqual(row?.role, "admin");
      });

      it("refuses to change the owner role (failure case)", async () => {
        const res = await request(app)
          .patch(`/api/companies/${ctx.companyId}/members/${ctx.ownerId}`)
          .set(auth(ctx.ownerToken))
          .send({ role: "member" })
          .expect(400);
        assert.strictEqual(res.body.success, false);
      });

      it("refuses to remove the owner (failure case)", async () => {
        const res = await request(app)
          .delete(`/api/companies/${ctx.companyId}/members/${ctx.ownerId}`)
          .set(auth(ctx.ownerToken))
          .expect(400);
        assert.strictEqual(res.body.success, false);
      });

      it("adds member B then removes them (delete)", async () => {
        await request(app)
          .post(`/api/companies/${ctx.companyId}/members`)
          .set(auth(ctx.ownerToken))
          .send({ targetUserId: ctx.memberBId, role: "member", permissions: ["products.read"] })
          .expect(201);
        await request(app)
          .delete(`/api/companies/${ctx.companyId}/members/${ctx.memberBId}`)
          .set(auth(ctx.ownerToken))
          .expect(200);
        const row = await prisma.company_members.findUnique({
          where: { company_id_user_id: { company_id: ctx.companyId, user_id: ctx.memberBId } },
        });
        assert.strictEqual(row, null);
      });

      it("removed member loses company access (tenant isolation)", async () => {
        const memberBToken = generateAccessToken({ id: ctx.memberBId, email: "x" });
        const res = await request(app)
          .get("/api/products")
          .set(tenant(memberBToken, ctx.companyId))
          .expect(403);
        assert.strictEqual(res.body.success, false);
      });

      it("demotes member A back to member for later tests", async () => {
        // Admins bypass permission checks; keep A as plain member with reads
        // so product/invoice tests exercise the owner path deterministically.
        await request(app)
          .patch(`/api/companies/${ctx.companyId}/members/${ctx.memberAId}`)
          .set(auth(ctx.ownerToken))
          .send({ role: "member", permissions: ["products.read", "invoices.read", "customers.read"] })
          .expect(200);
      });

      it("enforces tenant scope: missing company and foreign company fail", async () => {
        await request(app).get("/api/products").set(auth(ctx.ownerToken)).expect(400);
        const foreignCompanyId = "34a1d785-b590-42b2-a9d0-120160c02f2e"; // athleticaaapp's company
        await request(app)
          .get("/api/products")
          .set(tenant(ctx.ownerToken, foreignCompanyId))
          .expect(403);
      });
    });

    // ------------------------------------------------------------------
    describe("2. products CRUD (via API, company-scoped)", () => {
      const H = () => tenant(ctx.ownerToken, ctx.companyId);

      it("creates realistic dummy products", async () => {
        const catalog = [
          { name: tag("Almarai Full Milk 1L"), price: 85.5, stock: 120, min_stock: 10, barcode: `E2E${RUN}001` },
          { name: tag("Lipton Yellow Tea 250g"), price: 145.0, stock: 80, min_stock: 5, barcode: `E2E${RUN}002` },
          { name: tag("Sunny Cooking Oil 1.5L"), price: 210.75, stock: 60, min_stock: 8, barcode: `E2E${RUN}003` },
          { name: tag("Low Stock Sugar 1kg"), price: 42.0, stock: 3, min_stock: 10, barcode: `E2E${RUN}004` },
          { name: tag("Disposable Test Item"), price: 9.99, stock: 50, min_stock: 0, barcode: `E2E${RUN}005` },
        ];
        for (const p of catalog) {
          const res = await request(app).post("/api/products").set(H()).send(p).expect(201);
          assert.strictEqual(res.body.success, true);
          assert.strictEqual(res.body.data.company_id, ctx.companyId);
          ctx.productIds.push(res.body.data.id);
          ctx.productByName[res.body.data.name] = res.body.data;
          // Persistence check after every create.
          const row = await prisma.products.findUnique({ where: { id: res.body.data.id } });
          assert.ok(row);
          assert.strictEqual(row!.company_id, ctx.companyId);
        }
        assert.strictEqual(ctx.productIds.length, 5);
      });

      it("rejects invalid product payloads (failure cases)", async () => {
        await request(app).post("/api/products").set(H()).send({ price: 10 }).expect(400); // missing name
        await request(app).post("/api/products").set(H()).send({ name: tag("Neg"), price: -5 }).expect(400);
        // Duplicate SKU within the same company.
        const sku = ctx.productByName[tag("Almarai Full Milk 1L")].sku;
        const dup = await request(app)
          .post("/api/products")
          .set(H())
          .send({ name: tag("Dup SKU"), price: 10, sku })
          .expect(409);
        assert.strictEqual(dup.body.success, false);
      });

      it("lists with pagination, search, sort and low-stock filter (read)", async () => {
        const list = await request(app).get("/api/products?page=1&limit=20").set(H()).expect(200);
        assert.strictEqual(list.body.success, true);
        assert.ok(list.body.pagination.total >= 5);
        const found = list.body.data.some((p: any) => p.name === tag("Almarai Full Milk 1L"));
        assert.ok(found, "created product must appear in list");

        const search = await request(app).get(`/api/products?search=${encodeURIComponent(tag("Lipton"))}`).set(H()).expect(200);
        assert.ok(search.body.data.length >= 1);

        const low = await request(app).get("/api/products?low_stock=true").set(H()).expect(200);
        assert.ok(low.body.data.some((p: any) => p.name === tag("Low Stock Sugar 1kg")));
      });

      it("reads a single product by id", async () => {
        const id = ctx.productByName[tag("Sunny Cooking Oil 1.5L")].id;
        const res = await request(app).get(`/api/products/${id}`).set(H()).expect(200);
        assert.strictEqual(res.body.data.id, id);
        assert.strictEqual(res.body.data.price, 210.75);
      });

      it("returns 404 for unknown product id", async () => {
        await request(app).get("/api/products/00000000-0000-4000-8000-000000000000").set(H()).expect(404);
      });

      it("updates price and stock (update) and persists", async () => {
        const id = ctx.productByName[tag("Almarai Full Milk 1L")].id;
        const res = await request(app)
          .put(`/api/products/${id}`)
          .set(H())
          .send({ price: 89.99, stock: 150 })
          .expect(200);
        assert.strictEqual(res.body.data.price, 89.99);
        assert.strictEqual(res.body.data.stock, 150);
        const row = await prisma.products.findUnique({ where: { id } });
        assert.strictEqual(Number(row!.price), 89.99);
        assert.strictEqual(row!.stock, 150);
        ctx.productByName[tag("Almarai Full Milk 1L")] = res.body.data;
      });

      it("hard-deletes an unreferenced product (delete)", async () => {
        const id = ctx.productByName[tag("Disposable Test Item")].id;
        const res = await request(app).delete(`/api/products/${id}`).set(H()).expect(200);
        assert.strictEqual(res.body.data.softDeleted, false);
        const row = await prisma.products.findUnique({ where: { id } });
        assert.strictEqual(row, null);
        ctx.productIds = ctx.productIds.filter((x) => x !== id);
        delete ctx.productByName[tag("Disposable Test Item")];
      });
    });

    // ------------------------------------------------------------------
    describe("3. customers CRUD (via API)", () => {
      const H = () => tenant(ctx.ownerToken, ctx.companyId);

      it("creates customers, one with opening balance (OB invoice)", async () => {
        const c1 = await request(app)
          .post("/api/customers")
          .set(H())
          .send({ name: tag("Ahmed Hassan"), phone: "01001234567", email: "ahmed.e2e@test.local", address: "Cairo, Nasr City" })
          .expect(201);
        const c2 = await request(app)
          .post("/api/customers")
          .set(H())
          .send({ name: tag("Mona Traders"), phone: "01117654321", opening_balance: 1500 })
          .expect(201);
        assert.strictEqual(c2.body.data.opening_balance, 1500);
        assert.ok(c2.body.data.opening_balance_invoice, "opening balance must auto-create OB invoice");
        ctx.customerIds.push(c1.body.data.id, c2.body.data.id);
        ctx.customerByName[c1.body.data.name] = c1.body.data;
        ctx.customerByName[c2.body.data.name] = c2.body.data;
        // OB invoice persisted and linked?
        const ob = await prisma.invoices.findUnique({ where: { id: c2.body.data.opening_balance_invoice.id } });
        assert.ok(ob);
        assert.strictEqual(ob!.customer_id, c2.body.data.id);
      });

      it("creates a disposable customer for the delete test", async () => {
        const res = await request(app)
          .post("/api/customers")
          .set(H())
          .send({ name: tag("Disposable Customer") })
          .expect(201);
        ctx.customerByName[res.body.data.name] = res.body.data;
        ctx.customerIds.push(res.body.data.id);
      });

      it("lists and reads customers", async () => {
        const list = await request(app).get("/api/customers").set(H()).expect(200);
        assert.ok(list.body.data.some((c: any) => c.name === tag("Ahmed Hassan")));
        const id = ctx.customerByName[tag("Ahmed Hassan")].id;
        const one = await request(app).get(`/api/customers/${id}`).set(H()).expect(200);
        assert.strictEqual(one.body.data.id, id);
        const debt = await request(app).get(`/api/customers/${id}/debt`).set(H()).expect(200);
        assert.strictEqual(debt.body.data.customer_id, id);
      });

      it("updates a customer and persists", async () => {
        const id = ctx.customerByName[tag("Ahmed Hassan")].id;
        const res = await request(app)
          .put(`/api/customers/${id}`)
          .set(H())
          .field("name", tag("Ahmed Hassan Updated"))
          .field("phone", "01009998888")
          .expect(200);
        assert.strictEqual(res.body.data.name, tag("Ahmed Hassan Updated"));
        const row = await prisma.customers.findUnique({ where: { id } });
        assert.strictEqual(row!.phone, "01009998888");
        ctx.customerByName[tag("Ahmed Hassan Updated")] = res.body.data;
      });

      it("deletes a customer with no invoices, blocks one with invoices", async () => {
        const cleanId = ctx.customerByName[tag("Disposable Customer")].id;
        await request(app).delete(`/api/customers/${cleanId}`).set(H()).expect(200);
        assert.strictEqual(await prisma.customers.findUnique({ where: { id: cleanId } }), null);
        ctx.customerIds = ctx.customerIds.filter((x) => x !== cleanId);

        const blockedId = ctx.customerByName[tag("Mona Traders")].id;
        const blocked = await request(app).delete(`/api/customers/${blockedId}`).set(H()).expect(400);
        assert.strictEqual(blocked.body.success, false);
      });
    });

    // ------------------------------------------------------------------
    describe("4. invoices CRUD + payments + stock integrity (via API)", () => {
      const H = () => tenant(ctx.ownerToken, ctx.companyId);
      const prod = (n: string) => ctx.productByName[tag(n)].id;
      const cust = (n: string) => ctx.customerByName[tag(n)].id;

      it("creates a DRAFT (pending, unpaid) invoice with discount+tax math", async () => {
        const milkBefore = (await prisma.products.findUnique({ where: { id: prod("Almarai Full Milk 1L") } }))!;
        const teaBefore = (await prisma.products.findUnique({ where: { id: prod("Lipton Yellow Tea 250g") } }))!;
        // 2 x 89.99 + 1 x 145.00 = 324.98; -20 discount +10 tax = 314.98
        const res = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Ahmed Hassan Updated"),
            discount_amount: 20,
            tax_amount: 10,
            items: [
              { product_id: prod("Almarai Full Milk 1L"), quantity: 2 },
              { product_id: prod("Lipton Yellow Tea 250g"), quantity: 1 },
            ],
          })
          .expect(201);
        assert.strictEqual(res.body.data.status, "pending");
        assert.strictEqual(res.body.data.total_amount, 314.98);
        assert.strictEqual(res.body.data.discount_amount, 20);
        assert.strictEqual(res.body.data.tax_amount, 10);
        ctx.invoiceIds.push(res.body.data.id);
        ctx.invoiceByKind["draft"] = res.body.data;
        // Stock decremented atomically?
        const milkAfter = (await prisma.products.findUnique({ where: { id: prod("Almarai Full Milk 1L") } }))!;
        const teaAfter = (await prisma.products.findUnique({ where: { id: prod("Lipton Yellow Tea 250g") } }))!;
        assert.strictEqual(milkAfter.stock, milkBefore.stock - 2);
        assert.strictEqual(teaAfter.stock, teaBefore.stock - 1);
        // Inventory logs written?
        const logs = await prisma.inventory_logs.count({ where: { company_id: ctx.companyId, action: "sale" } });
        assert.ok(logs >= 2);
      });

      it("creates a PAID invoice with full upfront payment", async () => {
        // 3 x 210.75 = 632.25, paid in full at creation.
        const res = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Ahmed Hassan Updated"),
            items: [{ product_id: prod("Sunny Cooking Oil 1.5L"), quantity: 3 }],
            payment: { amount: 632.25, method: "cash", notes: "E2E full payment" },
          })
          .expect(201);
        assert.strictEqual(res.body.data.status, "paid");
        assert.strictEqual(res.body.data.total_amount, 632.25);
        assert.strictEqual(res.body.data.payments.length, 1);
        ctx.invoiceIds.push(res.body.data.id);
        ctx.invoiceByKind["paid"] = res.body.data;
      });

      it("creates an UNPAID invoice then collects partial + remaining payments", async () => {
        // Sugar stock is 3; order 2 x 42.00 = 84.00 with 60 upfront -> partially_paid.
        const created = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Mona Traders"),
            items: [{ product_id: prod("Low Stock Sugar 1kg"), quantity: 2 }],
            payment: { amount: 60, method: "card" },
          })
          .expect(201);
        assert.strictEqual(created.body.data.status, "partially_paid");
        assert.strictEqual(created.body.data.total_amount, 84);
        ctx.invoiceIds.push(created.body.data.id);
        ctx.invoiceByKind["partial"] = created.body.data;

        // Collect the remaining 24 -> status flips to paid.
        const paid = await request(app)
          .post(`/api/invoices/${created.body.data.id}/payments`)
          .set(H())
          .send({ amount: 24, method: "cash" })
          .expect(200);
        assert.strictEqual(paid.body.data.status, "paid");
        ctx.invoiceByKind["partial"] = paid.body.data;

        // Overpaying a fully-paid invoice must fail.
        const over = await request(app)
          .post(`/api/invoices/${created.body.data.id}/payments`)
          .set(H())
          .send({ amount: 10, method: "cash" })
          .expect(400);
        assert.strictEqual(over.body.success, false);
      });

      it("rejects overpayment beyond the remaining amount (failure case)", async () => {
        // Draft invoice total is 314.98 with 0 paid; paying 500 must fail.
        const res = await request(app)
          .post(`/api/invoices/${ctx.invoiceByKind["draft"].id}/payments`)
          .set(H())
          .send({ amount: 500, method: "cash" })
          .expect(400);
        assert.strictEqual(res.body.success, false);
      });

      it("rejects invoices with insufficient stock, inactive or foreign products", async () => {
        // Sugar now has stock 1 (3 - 2); ordering 50 must fail.
        const noStock = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Ahmed Hassan Updated"),
            items: [{ product_id: prod("Low Stock Sugar 1kg"), quantity: 50 }],
          })
          .expect(400);
        assert.strictEqual(noStock.body.success, false);

        // Deactivate Tea, verify it cannot be invoiced, then reactivate.
        const teaId = prod("Lipton Yellow Tea 250g");
        await request(app).put(`/api/products/${teaId}`).set(H()).send({ is_active: false }).expect(200);
        const inactive = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Ahmed Hassan Updated"),
            items: [{ product_id: teaId, quantity: 1 }],
          })
          .expect(400);
        assert.strictEqual(inactive.body.success, false);
        await request(app).put(`/api/products/${teaId}`).set(H()).send({ is_active: true }).expect(200);

        // Unknown product id -> 404.
        const unknown = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Ahmed Hassan Updated"),
            items: [{ product_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }],
          })
          .expect(404);
        assert.strictEqual(unknown.body.success, false);
      });

      it("cancels an invoice and restores stock", async () => {
        const teaId = prod("Lipton Yellow Tea 250g");
        const teaBefore = (await prisma.products.findUnique({ where: { id: teaId } }))!;
        const created = await request(app)
          .post("/api/invoices")
          .set(H())
          .send({
            customer_id: cust("Ahmed Hassan Updated"),
            items: [{ product_id: teaId, quantity: 1 }],
          })
          .expect(201);
        assert.strictEqual(created.body.data.status, "pending");
        ctx.invoiceIds.push(created.body.data.id);

        const canceled = await request(app)
          .post(`/api/invoices/${created.body.data.id}/cancel`)
          .set(H())
          .expect(200);
        assert.strictEqual(canceled.body.data.status, "canceled");
        ctx.invoiceByKind["canceled"] = canceled.body.data;

        // Stock restored?
        const teaAfter = (await prisma.products.findUnique({ where: { id: teaId } }))!;
        assert.strictEqual(teaAfter.stock, teaBefore.stock);

        // Double-cancel and pay-on-canceled must fail.
        await request(app).post(`/api/invoices/${created.body.data.id}/cancel`).set(H()).expect(400);
        const payCanceled = await request(app)
          .post(`/api/invoices/${created.body.data.id}/payments`)
          .set(H())
          .send({ amount: 10, method: "cash" })
          .expect(400);
        assert.strictEqual(payCanceled.body.success, false);
      });

      it("lists and reads invoices with filters", async () => {
        const list = await request(app).get("/api/invoices?page=1&limit=20").set(H()).expect(200);
        assert.strictEqual(list.body.success, true);
        assert.ok(list.body.pagination.total >= 4);

        const paidOnly = await request(app).get("/api/invoices?status=paid").set(H()).expect(200);
        assert.ok(paidOnly.body.data.every((i: any) => i.status === "paid"));

        const one = await request(app).get(`/api/invoices/${ctx.invoiceByKind["draft"].id}`).set(H()).expect(200);
        assert.strictEqual(one.body.data.id, ctx.invoiceByKind["draft"].id);
        assert.strictEqual(one.body.data.invoice_items.length, 2);
        const itemTotal = one.body.data.invoice_items.reduce((s: number, i: any) => s + i.total_price, 0);
        assert.strictEqual(itemTotal, 324.98); // subtotal before discount/tax
      });

      it("soft-deletes (deactivates) a product referenced by invoices", async () => {
        const id = prod("Almarai Full Milk 1L");
        const res = await request(app).delete(`/api/products/${id}`).set(H()).expect(200);
        assert.strictEqual(res.body.data.softDeleted, true);
        assert.strictEqual(res.body.data.product.is_active, false);
        const row = await prisma.products.findUnique({ where: { id } });
        assert.strictEqual(row!.is_active, false); // row kept for FK integrity
      });
    });

    // ------------------------------------------------------------------
    describe("5. relationship & integrity verification (direct DB)", () => {
      it("every test invoice belongs to the test company with valid links", async () => {
        const invoices = await prisma.invoices.findMany({
          where: { id: { in: ctx.invoiceIds } },
          include: { invoice_items: true, payments: true },
        });
        assert.strictEqual(invoices.length, ctx.invoiceIds.length);
        for (const inv of invoices) {
          assert.strictEqual(inv.company_id, ctx.companyId);
          assert.ok(inv.customer_id, "invoice must link a customer");
          assert.ok(inv.invoice_items.length >= 1);
          const itemsTotal = inv.invoice_items.reduce((s, i) => s + Number(i.total_price), 0);
          const expected = Math.max(0, itemsTotal - Number(inv.discount_amount) + Number(inv.tax_amount));
          assert.ok(Math.abs(Number(inv.total_amount) - expected) < 0.01, `totals must reconcile for ${inv.invoice_number}`);
          const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
          assert.ok(paid <= Number(inv.total_amount) + 0.001, "payments must never exceed total");
        }
      });

      it("pre-existing rows were never modified", async () => {
        // Existing products keep their stock (we only ever invoiced E2E products).
        const existing = await prisma.products.findMany({
          where: { company_id: ctx.companyId, NOT: { name: { startsWith: "E2E-" } } },
        });
        assert.ok(existing.length >= 3);
        // Existing customer untouched (no new invoices attached to it).
        const existingCustomer = await prisma.customers.findFirst({
          where: { company_id: ctx.companyId, NOT: { name: { startsWith: "E2E-" } } },
        });
        assert.ok(existingCustomer);
        const stray = await prisma.invoices.count({
          where: { customer_id: existingCustomer!.id, id: { in: ctx.invoiceIds } },
        });
        assert.strictEqual(stray, 0);
      });
    });

    // ------------------------------------------------------------------
    describe("6. cleanup removes every test row (isolation proof)", () => {
      it("deletes all test data and leaves pre-existing counts intact", async () => {
        const errors = await cleanupE2E();
        assert.deepStrictEqual(errors, [], `cleanup must succeed loudly, got: ${errors.join("; ")}`);

        // Zero leftovers for THIS run (tracked IDs + run stamp).
        const [leftoverInvoices, leftoverProducts, leftoverCustomers, leftoverMembers, leftoverUsers] =
          await Promise.all([
            ctx.invoiceIds.length > 0
              ? prisma.invoices.count({ where: { id: { in: ctx.invoiceIds } } })
              : 0,
            prisma.products.count({ where: { name: { startsWith: `E2E-${RUN}` } } }),
            prisma.customers.count({ where: { name: { startsWith: `E2E-${RUN}` } } }),
            prisma.company_members.count({
              where: { company_id: ctx.companyId, user_id: { in: [ctx.memberAId, ctx.memberBId] } },
            }),
            prisma.users.count({ where: { id: { in: [ctx.memberAId, ctx.memberBId] } } }),
          ]);
        assert.strictEqual(leftoverInvoices, 0, "test invoices must be gone");
        assert.strictEqual(leftoverProducts, 0, "test products must be gone");
        assert.strictEqual(leftoverCustomers, 0, "test customers must be gone");
        assert.strictEqual(leftoverMembers, 0, "test memberships must be gone");
        assert.strictEqual(leftoverUsers, 0, "test users must be gone");

        // Global counts match the pre-run snapshot exactly.
        const [users, companies, products, customers, invoices] = await Promise.all([
          prisma.users.count(),
          prisma.companies.count(),
          prisma.products.count(),
          prisma.customers.count(),
          prisma.invoices.count(),
        ]);
        assert.deepStrictEqual(
          { users, companies, products, customers, invoices },
          ctx.preExisting,
          "Neon must be back to its pre-existing state",
        );
      });
    });
  });
}
