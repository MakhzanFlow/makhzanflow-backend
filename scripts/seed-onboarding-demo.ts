/**
 * Onboarding-demo seed for screenshots (ALMARAI company only).
 *
 * Dataset: Carrefour Egypt Fresh Food (FEGY1600000) — real product names,
 * sizes, prices and CDN image URLs, fetched via product pages.
 *
 * Populates persistent demo data THROUGH the real HTTP API (supertest):
 *   demo users -> members with roles/permissions -> products (+images)
 *   -> customers -> invoices + payments -> backdated history for charts.
 *
 * Idempotent: users/members/join-requests are found-or-created (safe to
 * re-run); products/customers/invoices are created fresh. The guard aborts
 * only ifSeed products (FF- SKUs) already exist.
 *
 * Run:  $env:NODE_ENV='production'; npm run seed:demo
 * Login password for every demo user: Demo1234!
 */
import "reflect-metadata";
import "../src/shared/di/container.js";
// Bypass the shared Upstash 100 req / 15 min window for this single-process
// run (per-route express limiters still apply — paced with sleep below).
process.env["DISABLE_RATE_LIMIT"] = "1";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { generateAccessToken } from "../src/shared/utils/jwt.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PACED_MS = 7000; // keeps POST /products + POST /invoices under 10 req/min

const DEMO_PASSWORD = "Demo1234!";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dueIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
};
const noonUTC = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T12:00:00.000Z`);
const must = (v: string | undefined, what: string): string => {
  if (!v) throw new Error(`Missing expected value: ${what}`);
  return v;
};

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------
interface DemoUser {
  name: string;
  email: string;
  company: "almarai";
  role: "admin" | "member" | "outsider";
  permissions: string[];
}

const DEMO_USERS: DemoUser[] = [
  // almarai — grocery / food
  { name: "Sara Mahmoud", email: "sara.mahmoud@demo.makhzanflow.com", company: "almarai", role: "admin", permissions: [] },
  { name: "Ahmed Samy", email: "ahmed.samy@demo.makhzanflow.com", company: "almarai", role: "member", permissions: ["products.read", "invoices.read", "invoices.create", "customers.read", "customers.create", "payments.read", "payments.create"] },
  { name: "Omar Khaled", email: "omar.khaled@demo.makhzanflow.com", company: "almarai", role: "member", permissions: ["products.read", "products.create", "products.update", "customers.read"] },
  { name: "Youssef Nabil", email: "youssef.nabil@demo.makhzanflow.com", company: "almarai", role: "outsider", permissions: [] },
];

interface DemoProduct {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  stock: number;
  min_stock: number;
  expiry_date?: string;
  /** Carrefour CDN image — set via Prisma after creation (API has no image_url field). */
  image: string;
}

const CDN = "https://cdn.mafrservices.com/";
const IMG = (p: string) => `${CDN}${p}?im=Resize=376`;

// Source: Carrefour Egypt Fresh Food (FEGY1600000) — real names, sizes, prices.
const GOLD_PRODUCTS: DemoProduct[] = [
  { name: "Almarai Full Cream Milk 1L", sku: "FF-3001", barcode: "6223003000019", price: 53.5, stock: 120, min_stock: 12, expiry_date: "2026-09-20", image: IMG("sys-master-root/hcb/hee/48220799008798/512348_main.jpg") },
  { name: "Balady Minced Beef 500g", sku: "FF-3002", barcode: "6223003000026", price: 190.0, stock: 40, min_stock: 8, expiry_date: "2026-09-08", image: IMG("sys-master-root/h8c/ha2/30490078937118/31991_main.jpg") },
  { name: "Balady Low Fat Beef Cubes 500g", sku: "FF-3003", barcode: "6223003000033", price: 255.0, stock: 30, min_stock: 6, expiry_date: "2026-09-08", image: IMG("sys-master-root/hbb/h0c/10856167702558/426177_main.jpg") },
  { name: "Halwani Smoked Turkey 250g", sku: "FF-3004", barcode: "6223003000040", price: 161.75, stock: 25, min_stock: 5, expiry_date: "2026-09-25", image: IMG("pim-content/EGY/media/product/318625/1742382004/318625_main.jpg") },
  { name: "Beef Sausage 500g", sku: "FF-3005", barcode: "6223003000057", price: 192.5, stock: 35, min_stock: 7, expiry_date: "2026-09-10", image: IMG("sys-master-root/h23/h9f/30490078838814/32400_main.jpg") },
  { name: "Juhayna Cooking Cream 1L", sku: "FF-3006", barcode: "6223003000064", price: 219.99, stock: 30, min_stock: 6, expiry_date: "2026-10-30", image: IMG("sys-master-root/hc6/h1a/26626177040414/181146_main.jpg") },
  { name: "Gouda Cheese 250g", sku: "FF-3007", barcode: "6223003000071", price: 145.0, stock: 8, min_stock: 8, expiry_date: "2026-09-18", image: IMG("sys-master-root/h5a/h21/9342673158174/437276_main.jpg") },
  { name: "Almarai Natural Yogurt 105g 6-Count", sku: "FF-3008", barcode: "6223003000088", price: 52.99, stock: 48, min_stock: 10, expiry_date: "2026-09-12", image: IMG("pim-content/EGY/media/product/575827/1751279403/575827_main.jpg") },
  { name: "Almarai Cooking Cream 200ml", sku: "FF-3009", barcode: "6223003000095", price: 61.99, stock: 40, min_stock: 8, expiry_date: "2026-10-15", image: IMG("sys-master-root/ha7/hfa/30871347167262/441296_main.jpg") },
  { name: "Almarai Greek Yogurt 5% 170g", sku: "FF-3010", barcode: "6223003000101", price: 32.99, stock: 36, min_stock: 12, expiry_date: "2026-09-11", image: IMG("pim-content/EGY/media/product/555747/1751279403/555747_main.jpg") },
  { name: "Cheesa Edam Cheese 250g", sku: "FF-3011", barcode: "6223003000118", price: 119.99, stock: 22, min_stock: 5, expiry_date: "2026-10-01", image: IMG("sys-master-root/ha2/hf5/11343207301150/279632_main.jpg") },
  { name: "Koki Bone-In Chicken Breasts 1kg", sku: "FF-3012", barcode: "6223003000125", price: 149.99, stock: 25, min_stock: 5, expiry_date: "2026-09-07", image: IMG("sys-master-root/h9c/hfc/14684993060894/323864_main.jpg") },
  { name: "Baramily Cheese 250g", sku: "FF-3013", barcode: "6223003000132", price: 43.75, stock: 20, min_stock: 15, expiry_date: "2026-09-15", image: IMG("sys-master-root/h6d/h1b/9342407966750/327042_main.jpg") },
  { name: "Katilo Low Salt Cheese 250g", sku: "FF-3014", barcode: "6223003000149", price: 39.99, stock: 8, min_stock: 10, expiry_date: "2026-09-14", image: IMG("sys-master-root/h7a/hbf/45880927944734/487169_main.jpg") },
];


interface DemoCustomer {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  opening_balance?: number;
}

const GOLD_CUSTOMERS: DemoCustomer[] = [
  { name: "Ahmed Hassan", phone: "01001234567", email: "ahmed.hassan.egy@gmail.com", address: "12 Abbas El Akkad, Nasr City" },
  { name: "Mohamed El-Sayed Grocery", phone: "01112223333", address: "Attaba Market, Cairo", opening_balance: 2500 },
  { name: "Sara Supermarket", phone: "01221112222", address: "New Maadi, Cairo" },
  { name: "Karim Kiosk", phone: "01554443333", address: "Faisal, Giza", opening_balance: 800 },
  { name: "Nour Mini Market", phone: "01099887766", address: "Heliopolis, Cairo" },
  { name: "Hassan El-Banna Store", phone: "01033334444", address: "Shubra, Cairo" },
  { name: "El-Nour Supermarket", phone: "01155556666", address: "Mohandessin, Giza" },
  { name: "Fathy & Sons", phone: "01277778888", address: "Tanta", opening_balance: 1800 },
  { name: "Dina Pharmacy Market", phone: "01500001111", address: "Sheikh Zayed" },
];



interface DemoInvoiceItem {
  product: string; // SKU
  quantity: number;
}
interface DemoInvoice {
  key: string;
  customer: string;
  items: DemoInvoiceItem[];
  discount_amount?: number;
  tax_amount?: number;
  dueInDays: number;
  payment?: { amount: number; method: "cash" | "card" | "bank_transfer" | "other" };
  backdate?: string; // YYYY-MM-DD — spread history for dashboard charts (omit = today)
}

const GOLD_INVOICES: DemoInvoice[] = [
  { key: "N1", customer: "Ahmed Hassan", items: [{ product: "FF-3001", quantity: 4 }, { product: "FF-3008", quantity: 2 }], discount_amount: 20, dueInDays: 7, payment: { amount: 299.98, method: "cash" } },
  { key: "N2", customer: "Sara Supermarket", items: [{ product: "FF-3002", quantity: 3 }, { product: "FF-3005", quantity: 2 }], dueInDays: -3, payment: { amount: 400, method: "card" } },
  { key: "N3", customer: "Karim Kiosk", items: [{ product: "FF-3003", quantity: 4 }, { product: "FF-3004", quantity: 2 }], dueInDays: 14, backdate: "2026-08-18" },
  { key: "N4", customer: "Nour Mini Market", items: [{ product: "FF-3007", quantity: 2 }, { product: "FF-3011", quantity: 1 }], discount_amount: 10, dueInDays: 7, payment: { amount: 399.99, method: "cash" }, backdate: "2026-08-22" },
  { key: "N5", customer: "Ahmed Hassan", items: [{ product: "FF-3001", quantity: 6 }, { product: "FF-3006", quantity: 2 }, { product: "FF-3010", quantity: 4 }], tax_amount: 50, dueInDays: -10, payment: { amount: 500, method: "cash" }, backdate: "2026-07-16" },
  { key: "N6", customer: "Sara Supermarket", items: [{ product: "FF-3012", quantity: 2 }, { product: "FF-3005", quantity: 3 }], dueInDays: 14, backdate: "2026-07-10" },
  { key: "N7", customer: "Mohamed El-Sayed Grocery", items: [{ product: "FF-3002", quantity: 5 }, { product: "FF-3003", quantity: 2 }], discount_amount: 60, dueInDays: 7, payment: { amount: 1400, method: "cash" } },
  { key: "N8", customer: "Hassan El-Banna Store", items: [{ product: "FF-3013", quantity: 6 }, { product: "FF-3014", quantity: 4 }], dueInDays: 7, payment: { amount: 422.46, method: "cash" } },
  { key: "N9", customer: "El-Nour Supermarket", items: [{ product: "FF-3004", quantity: 4 }, { product: "FF-3011", quantity: 3 }], dueInDays: 7, payment: { amount: 500, method: "card" } },
  { key: "N10", customer: "Fathy & Sons", items: [{ product: "FF-3009", quantity: 8 }, { product: "FF-3010", quantity: 6 }], dueInDays: 14, backdate: "2026-08-08" },
  { key: "N11", customer: "Dina Pharmacy Market", items: [{ product: "FF-3012", quantity: 1 }, { product: "FF-3007", quantity: 1 }], dueInDays: 7, payment: { amount: 294.99, method: "cash" }, backdate: "2026-08-25" },
  { key: "N12", customer: "Hassan El-Banna Store", items: [{ product: "FF-3002", quantity: 2 }, { product: "FF-3005", quantity: 1 }], tax_amount: 30, dueInDays: -20, payment: { amount: 200, method: "cash" }, backdate: "2026-07-20" },
  { key: "N13", customer: "El-Nour Supermarket", items: [{ product: "FF-3014", quantity: 1 }, { product: "FF-3013", quantity: 2 }], dueInDays: 7, payment: { amount: 127.49, method: "cash" }, backdate: "2026-06-20" },
];


// ---------------------------------------------------------------------------
async function main() {
  const now = new Date();
  console.log(`Seed start @ ${now.toISOString()}`);
  if (now.getFullYear() !== 2026) {
    throw new Error(`Sanity check failed: expected clock in 2026, got ${now.toISOString()}`);
  }
  if (!process.env["DATABASE_URL"]?.includes("neon.tech")) {
    throw new Error("Refusing to seed: DATABASE_URL is not Neon. Run with NODE_ENV=production.");
  }

  // Resolve the company by OWNER (stable) — company names can be renamed
  // without breaking the seed. Only Almarai is seeded.
  const almaraiOwnerUser = await prisma.users.findUnique({ where: { email: "haazemsaidd@gmail.com" } });
  if (!almaraiOwnerUser) throw new Error("Owner user haazemsaidd@gmail.com must exist.");
  const almaraiMembership = await prisma.company_members.findFirst({
    where: { user_id: almaraiOwnerUser.id, role: "owner" }, include: { companies: true },
  });
  const almarai = (almaraiMembership as any)?.companies;
  if (!almarai) throw new Error("The almarai company must exist.");
  console.log(`  company: "${almarai.name}"`);
  const goldOwner = { user_id: almaraiOwnerUser.id, users: { email: almaraiOwnerUser.email } };

  // Idempotency guard — abort only if fresh-food products already exist
  // (users/members below are found-or-created, safe to re-run).
  const existingSku = await prisma.products.count({ where: { sku: { startsWith: "FF-" } } });
  if (existingSku > 0) {
    throw new Error(`Already seeded (FF- products: ${existingSku}). Aborting.`);
  }

  const C = {
    almarai: { id: almarai.id as string, invite: almarai.invite_code as string, token: generateAccessToken({ id: goldOwner.user_id, email: (goldOwner as any).users.email }) },
  };
  const T = (key: "almarai") => ({ Authorization: `Bearer ${C[key].token}`, "x-company-id": C[key].id });
  const H = (key: "almarai") => ({ Authorization: `Bearer ${C[key].token}` });

  async function post(path: string, headers: Record<string, string>, body: object, expected: number) {
    const res = await request(app).post(path).set(headers).send(body);
    if (res.status !== expected) {
      throw new Error(`POST ${path} -> ${res.status} (expected ${expected}): ${JSON.stringify(res.body).slice(0, 500)}`);
    }
    return res.body;
  }

  // --- 1. demo users (find-or-create; members from the earlier seed are reused) ---
  console.log("Ensuring demo users...");
  const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIdByEmail: Record<string, string> = {};
  for (const u of DEMO_USERS.filter((x) => x.company === "almarai")) {
    const existing = await prisma.users.findUnique({ where: { email: u.email } });
    if (existing) {
      if (!existing.is_verified) {
        await prisma.users.update({ where: { id: existing.id }, data: { is_verified: true, verified_at: new Date() } });
      }
      userIdByEmail[u.email] = existing.id;
      console.log(`  user exists: ${u.name}`);
    } else {
      const created = await prisma.users.create({
        data: { name: u.name, email: u.email, password_hash, is_verified: true, verified_at: new Date() },
      });
      userIdByEmail[u.email] = created.id;
      console.log(`  user created: ${u.name}`);
    }
  }

  // --- 2. members + join requests (existing memberships are updated to spec) ---
  for (const key of ["almarai"] as const) {
    for (const u of DEMO_USERS.filter((x) => x.company === key && x.role !== "outsider")) {
      const uid = must(userIdByEmail[u.email], `user id ${u.email}`);
      const already = await prisma.company_members.findUnique({
        where: { company_id_user_id: { company_id: C[key].id, user_id: uid } },
      });
      if (already) {
        const res = await request(app)
          .patch(`/api/companies/${C[key].id}/members/${uid}`)
          .set(H(key))
          .send({ role: u.role, permissions: u.permissions });
        if (res.status !== 200) throw new Error(`PATCH member ${u.email} -> ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
        console.log(`  member updated: ${u.name} (${u.role})`);
      } else {
        await post(`/api/companies/${C[key].id}/members`, H(key), {
          targetUserId: uid, role: u.role, permissions: u.permissions,
        }, 201);
        console.log(`  member added: ${u.name} (${u.role})`);
      }
    }
    const outsider = DEMO_USERS.find((x) => x.company === key && x.role === "outsider")!;
    const outsiderId = must(userIdByEmail[outsider.email], `user id ${outsider.email}`);
    const priorRequest = await prisma.join_requests.findFirst({
      where: { company_id: C[key].id, user_id: outsiderId },
    });
    if (priorRequest) {
      console.log(`  join request exists: ${outsider.name} (${priorRequest.status})`);
    } else {
      const outsiderToken = generateAccessToken({ id: outsiderId, email: outsider.email });
      await post("/api/companies/join", { Authorization: `Bearer ${outsiderToken}` }, { invite_code: C[key].invite }, 201);
      console.log(`  join request: ${outsider.name} -> ${key} (pending)`);
    }
  }

  // --- 3. products with Carrefour images (paced: 10/min limit) ---
  const skuToId: Record<string, string> = {};
  for (const key of ["almarai"] as const) {
    const catalog = GOLD_PRODUCTS;
    for (const p of catalog) {
      const { image, ...payload } = p; // image_url has no API field — set via Prisma below
      const body = await post("/api/products", T(key), payload, 201);
      skuToId[p.sku] = body.data.id;
      await prisma.products.update({ where: { id: body.data.id }, data: { image_url: image } });
      console.log(`  product: ${p.name} [img ok]`);
      await sleep(PACED_MS);
    }
  }

  // --- 4. customers ---
  const customerId: Record<string, string> = {}; // `${key}:${name}` -> id
  for (const key of ["almarai"] as const) {
    const list = GOLD_CUSTOMERS;
    for (const c of list) {
      const body = await post("/api/customers", T(key), c, 201);
      customerId[`${key}:${c.name}`] = body.data.id;
      console.log(`  customer: ${c.name}${c.opening_balance ? ` (OB ${c.opening_balance})` : ""}`);
    }
  }

  // --- 5. invoices (paced: 10/min limit) ---
  const invoiceIdByKey: Record<string, string> = {};
  const oldNumbers: Record<string, string> = {};
  for (const key of ["almarai"] as const) {
    const list = GOLD_INVOICES;
    for (const inv of list) {
      const payload: Record<string, unknown> = {
        customer_id: customerId[`${key}:${inv.customer}`],
        due_date: dueIn(inv.dueInDays),
        items: inv.items.map((i) => ({ product_id: skuToId[i.product], quantity: i.quantity })),
      };
      if (inv.discount_amount) payload["discount_amount"] = inv.discount_amount;
      if (inv.tax_amount) payload["tax_amount"] = inv.tax_amount;
      if (inv.payment) payload["payment"] = inv.payment;
      const body = await post("/api/invoices", T(key), payload, 201);
      invoiceIdByKey[inv.key] = body.data.id;
      oldNumbers[inv.key] = body.data.invoice_number;
      console.log(`  invoice ${inv.key}: ${body.data.invoice_number} total=${body.data.total_amount} status=${body.data.status}${inv.backdate ? ` -> backdate ${inv.backdate}` : ""}`);
      await sleep(PACED_MS);
    }
  }

  // --- 6. backdate history (dashboard monthly charts) + renumber to match dates ---
  console.log("Backdating history...");
  const seqByCompanyDate: Record<string, number> = {};
  for (const key of ["almarai"] as const) {
    const list = GOLD_INVOICES.filter((i) => i.backdate);
    for (const inv of list) {
      const dateStr = must(inv.backdate, `${inv.key}.backdate`);
      const invId = must(invoiceIdByKey[inv.key], `invoice id ${inv.key}`);
      const oldNumber = must(oldNumbers[inv.key], `invoice number ${inv.key}`);
      const seqKey = `${C[key].id}:${dateStr}`;
      seqByCompanyDate[seqKey] = (seqByCompanyDate[seqKey] ?? 0) + 1;
      const newNumber = `INV-${dateStr.replace(/-/g, "")}-${String(seqByCompanyDate[seqKey]).padStart(4, "0")}`;
      const created = noonUTC(dateStr);
      await prisma.invoices.update({
        where: { id: invId },
        data: { invoice_number: newNumber, created_at: created, updated_at: created },
      });
      await prisma.payments.updateMany({
        where: { invoice_id: invId },
        data: { created_at: new Date(`${dateStr}T13:00:00.000Z`) },
      });
      // Keep inventory notes consistent with the renumbered invoice.
      const logs = await prisma.inventory_logs.findMany({
        where: { company_id: C[key].id, notes: { contains: oldNumber } },
      });
      for (const log of logs) {
        await prisma.inventory_logs.update({
          where: { id: log.id },
          data: { notes: (log.notes ?? "").replace(oldNumber, newNumber), created_at: new Date(`${dateStr}T12:05:00.000Z`) },
        });
      }
      console.log(`  ${inv.key}: ${oldNumber} -> ${newNumber} @ ${dateStr}`);
    }
  }

  // --- 7. verify through the app ---
  console.log("Verifying...");
  for (const key of ["almarai"] as const) {
    const members = await request(app).get(`/api/companies/${C[key].id}/members`).set(H(key)).expect(200);
    const products = await request(app).get("/api/products?limit=100").set(T(key)).expect(200);
    const customers = await request(app).get("/api/customers?limit=100").set(T(key)).expect(200);
    const invoices = await request(app).get("/api/invoices?limit=100").set(T(key)).expect(200);
    const stats = await request(app).get("/api/dashboard/stats").set(T(key)).expect(200);
    const monthly = await request(app).get("/api/dashboard/monthly-report?months=6").set(T(key)).expect(200);
    const low = await request(app).get("/api/dashboard/low-stock").set(T(key)).expect(200);
    const joins = await request(app).get(`/api/companies/${C[key].id}/join-requests`).set(H(key)).expect(200);
    console.log(
      `  [${key}] members=${members.body.pagination.total} products=${products.body.pagination.total} ` +
      `customers=${customers.body.pagination.total} invoices=${invoices.body.pagination.total} ` +
      `todaySales=${stats.body.data.todaySales} debt=${stats.body.data.totalDebt} ` +
      `lowStock=${low.body.pagination.total} pendingJoins=${joins.body.data.length}`,
    );
    console.log(`  [${key}] monthly: ` + monthly.body.data.map((m: any) => `${m.month}(inv:${m.totalInvoices},rev:${m.totalRevenue},pay:${m.totalPayments})`).join(" "));
  }

  console.log(`\nDone. Demo login password for all users: ${DEMO_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("SEED FAILED:", err?.message ?? err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
