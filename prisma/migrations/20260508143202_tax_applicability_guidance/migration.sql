/*
  Warnings:

  - You are about to drop the column `taxQualifying` on the `Expense` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyPeriodId" TEXT NOT NULL,
    "userId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "spentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "importHash" TEXT,
    "payee" TEXT,
    "tagsJson" TEXT,
    "splitGroupId" TEXT,
    "budgetPlanId" TEXT,
    "receiptId" TEXT,
    "taxApplicability" TEXT,
    "taxCodeRefId" TEXT,
    "taxCategory" TEXT,
    "taxNote" TEXT,
    "taxReviewedAt" DATETIME,
    "taxReviewedByUserId" TEXT,
    CONSTRAINT "Expense_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_taxReviewedByUserId_fkey" FOREIGN KEY ("taxReviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amountCents", "budgetPlanId", "description", "id", "importHash", "monthlyPeriodId", "payee", "receiptId", "source", "spentAt", "splitGroupId", "tagsJson", "taxCategory", "taxNote", "taxReviewedAt", "taxReviewedByUserId", "userId", "taxApplicability", "taxCodeRefId") SELECT "amountCents", "budgetPlanId", "description", "id", "importHash", "monthlyPeriodId", "payee", "receiptId", "source", "spentAt", "splitGroupId", "tagsJson", "taxCategory", "taxNote", "taxReviewedAt", "taxReviewedByUserId", "userId", CASE WHEN "taxQualifying" = 1 THEN 'applicable' ELSE 'not_applicable' END, CASE WHEN "taxQualifying" = 1 THEN 'app_trade_business' ELSE 'na_personal_consumption' END FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_monthlyPeriodId_importHash_idx" ON "Expense"("monthlyPeriodId", "importHash");
CREATE INDEX "Expense_receiptId_idx" ON "Expense"("receiptId");
CREATE INDEX "Expense_taxApplicability_spentAt_idx" ON "Expense"("taxApplicability", "spentAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
