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
    CONSTRAINT "Expense_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amountCents", "budgetPlanId", "description", "id", "importHash", "monthlyPeriodId", "payee", "source", "spentAt", "splitGroupId", "tagsJson", "userId") SELECT "amountCents", "budgetPlanId", "description", "id", "importHash", "monthlyPeriodId", "payee", "source", "spentAt", "splitGroupId", "tagsJson", "userId" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE UNIQUE INDEX "Expense_receiptId_key" ON "Expense"("receiptId");
CREATE INDEX "Expense_monthlyPeriodId_importHash_idx" ON "Expense"("monthlyPeriodId", "importHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
