-- Soft-delete for companies + hot-path indexes + drop redundant indexes

-- 1. Soft-delete column
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "idx_companies_deleted_at" ON "companies"("deleted_at");

-- 2. Drop redundant indexes (unique constraints already index these)
DROP INDEX IF EXISTS "idx_refresh_tokens_token";
DROP INDEX IF EXISTS "idx_users_email";
DROP INDEX IF EXISTS "idx_verification_tokens_token";

-- 3. Hot-path indexes
CREATE INDEX IF NOT EXISTS "idx_customers_company_name" ON "customers"("company_id", "name");
CREATE INDEX IF NOT EXISTS "idx_customers_email" ON "customers"("email");
CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "customers"("phone");

CREATE INDEX IF NOT EXISTS "idx_inventory_logs_user" ON "inventory_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_logs_company_created" ON "inventory_logs"("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_invoice_items_product" ON "invoice_items"("product_id");

CREATE INDEX IF NOT EXISTS "idx_invoices_customer" ON "invoices"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "idx_invoices_created" ON "invoices"("created_at");
CREATE INDEX IF NOT EXISTS "idx_invoices_company_created" ON "invoices"("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_join_requests_company" ON "join_requests"("company_id");
CREATE INDEX IF NOT EXISTS "idx_join_requests_user" ON "join_requests"("user_id");

CREATE INDEX IF NOT EXISTS "idx_payments_created" ON "payments"("created_at");
CREATE INDEX IF NOT EXISTS "idx_payments_company_created" ON "payments"("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_products_company_name" ON "products"("company_id", "name");
CREATE INDEX IF NOT EXISTS "idx_products_company_active" ON "products"("company_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_billing_history_company" ON "billing_history"("company_id");
CREATE INDEX IF NOT EXISTS "idx_company_subscriptions_plan" ON "company_subscriptions"("plan_id");
