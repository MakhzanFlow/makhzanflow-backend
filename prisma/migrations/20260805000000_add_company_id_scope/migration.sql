-- Add company_id to inventory_logs (nullable first)
ALTER TABLE "inventory_logs" ADD COLUMN "company_id" UUID;

-- Backfill from products.company_id
UPDATE "inventory_logs" il
SET "company_id" = p.company_id
FROM "products" p
WHERE il.product_id = p.id;

-- Backfill any orphans (product deleted) from activity logs by reference - fallback: keep null and delete orphans
DELETE FROM "inventory_logs" WHERE "company_id" IS NULL;

-- Make NOT NULL + FK + index
ALTER TABLE "inventory_logs" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "idx_inventory_logs_company" ON "inventory_logs"("company_id");

-- Add company_id to payments (nullable first)
ALTER TABLE "payments" ADD COLUMN "company_id" UUID;

-- Backfill from invoices.company_id
UPDATE "payments" p
SET "company_id" = i.company_id
FROM "invoices" i
WHERE p.invoice_id = i.id;

-- Backfill any orphans from invoice deletion - delete them
DELETE FROM "payments" WHERE "company_id" IS NULL;

-- Make NOT NULL + FK + index
ALTER TABLE "payments" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "idx_payments_company" ON "payments"("company_id");
