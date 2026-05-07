/*
  Warnings:

  - Added the required column `updatedAt` to the `DebtAccount` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "NetWorthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetsCents" INTEGER NOT NULL,
    "liabilitiesCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "note" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BudgetPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyPeriodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "limitCents" INTEGER NOT NULL,
    "note" TEXT,
    "rolledInCents" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BudgetPlan_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetPlan" ("category", "id", "limitCents", "monthlyPeriodId", "name", "note") SELECT "category", "id", "limitCents", "monthlyPeriodId", "name", "note" FROM "BudgetPlan";
DROP TABLE "BudgetPlan";
ALTER TABLE "new_BudgetPlan" RENAME TO "BudgetPlan";
CREATE TABLE "new_DebtAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "minimumPaymentCents" INTEGER,
    "aprPercent" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DebtAccount" ("aprPercent", "balanceCents", "createdAt", "id", "minimumPaymentCents", "name", "note") SELECT "aprPercent", "balanceCents", "createdAt", "id", "minimumPaymentCents", "name", "note" FROM "DebtAccount";
DROP TABLE "DebtAccount";
ALTER TABLE "new_DebtAccount" RENAME TO "DebtAccount";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
