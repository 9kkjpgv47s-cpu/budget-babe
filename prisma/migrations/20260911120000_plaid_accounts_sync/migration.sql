-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "PlaidItem" ADD COLUMN "lastSyncError" TEXT;

-- CreateTable
CREATE TABLE "PlaidAccount" (
    "id" TEXT NOT NULL,
    "plaidItemId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "currentBalanceCents" INTEGER,
    "availableBalanceCents" INTEGER,
    "currency" TEXT,
    "syncToExpenses" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidAccount_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DebtAccount" ADD COLUMN "plaidAccountId" TEXT;

-- AlterTable
ALTER TABLE "NetWorthAccount" ADD COLUMN "plaidAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlaidAccount_accountId_key" ON "PlaidAccount"("accountId");

-- CreateIndex
CREATE INDEX "PlaidAccount_plaidItemId_idx" ON "PlaidAccount"("plaidItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtAccount_plaidAccountId_key" ON "DebtAccount"("plaidAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthAccount_plaidAccountId_key" ON "NetWorthAccount"("plaidAccountId");

-- AddForeignKey
ALTER TABLE "PlaidAccount" ADD CONSTRAINT "PlaidAccount_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
