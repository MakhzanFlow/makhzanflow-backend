-- AlterTable
ALTER TABLE "companies" ADD COLUMN "invite_code" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "companies_invite_code_key" ON "companies"("invite_code");
