-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nextPaycheckDate" DATETIME,
    "savingsRatePercentTarget" INTEGER NOT NULL DEFAULT 10,
    "payPeriodsPerMonth" INTEGER NOT NULL DEFAULT 2
);
INSERT INTO "new_HouseholdSettings" ("id", "nextPaycheckDate") SELECT "id", "nextPaycheckDate" FROM "HouseholdSettings";
DROP TABLE "HouseholdSettings";
ALTER TABLE "new_HouseholdSettings" RENAME TO "HouseholdSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
