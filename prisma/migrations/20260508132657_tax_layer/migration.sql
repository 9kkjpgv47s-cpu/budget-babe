-- CreateTable
CREATE TABLE "TaxExpenseAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxExpenseAudit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxExpenseAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "taxQualifying" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Expense" ("amountCents", "budgetPlanId", "description", "id", "importHash", "monthlyPeriodId", "payee", "receiptId", "source", "spentAt", "splitGroupId", "tagsJson", "userId") SELECT "amountCents", "budgetPlanId", "description", "id", "importHash", "monthlyPeriodId", "payee", "receiptId", "source", "spentAt", "splitGroupId", "tagsJson", "userId" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_monthlyPeriodId_importHash_idx" ON "Expense"("monthlyPeriodId", "importHash");
CREATE INDEX "Expense_receiptId_idx" ON "Expense"("receiptId");
CREATE INDEX "Expense_taxQualifying_spentAt_idx" ON "Expense"("taxQualifying", "spentAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaxExpenseAudit_expenseId_createdAt_idx" ON "TaxExpenseAudit"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "TaxExpenseAudit_createdAt_idx" ON "TaxExpenseAudit"("createdAt");
