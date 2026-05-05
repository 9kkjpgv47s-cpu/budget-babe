-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyPeriodId" TEXT,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "note" TEXT,
    "totalCents" INTEGER,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "ocrError" TEXT,
    "ocrRawText" TEXT,
    "ocrParsedLines" TEXT,
    "ocrConfidence" INTEGER,
    CONSTRAINT "Receipt_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("filename", "id", "monthlyPeriodId", "note", "totalCents", "uploadedAt", "userId") SELECT "filename", "id", "monthlyPeriodId", "note", "totalCents", "uploadedAt", "userId" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
