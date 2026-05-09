-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPeriod" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "incomeCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "MonthlyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paycheck" (
    "id" TEXT NOT NULL,
    "monthlyPeriodId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receivedOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "imageFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paycheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "monthlyPeriodId" TEXT NOT NULL,
    "userId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "taxReviewedAt" TIMESTAMP(3),
    "taxReviewedByUserId" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxExpenseAudit" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxExpenseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "monthlyPeriodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL,
    "monthlyPeriodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "limitCents" INTEGER NOT NULL,
    "note" TEXT,
    "rolledInCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantRule" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "userId" TEXT,
    "transactionsCursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "minimumPaymentCents" INTEGER,
    "aprPercent" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthAccount" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetWorthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetsCents" INTEGER NOT NULL,
    "liabilitiesCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "monthlyPeriodId" TEXT,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "note" TEXT,
    "totalCents" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "ocrError" TEXT,
    "ocrRawText" TEXT,
    "ocrParsedLines" TEXT,
    "ocrConfidence" INTEGER,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingTrip" (
    "id" TEXT NOT NULL,
    "storeName" TEXT,
    "shoppedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShoppingTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingTripItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER,

    CONSTRAINT "ShoppingTripItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetAmountCents" INTEGER NOT NULL,
    "savedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingAdjustment" (
    "id" TEXT NOT NULL,
    "savingsGoalId" TEXT,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nextPaycheckDate" TIMESTAMP(3),
    "savingsRatePercentTarget" INTEGER NOT NULL DEFAULT 10,
    "payPeriodsPerMonth" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "HouseholdSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPeriod_yearMonth_key" ON "MonthlyPeriod"("yearMonth");

-- CreateIndex
CREATE INDEX "Paycheck_monthlyPeriodId_receivedOn_idx" ON "Paycheck"("monthlyPeriodId", "receivedOn");

-- CreateIndex
CREATE INDEX "Expense_monthlyPeriodId_importHash_idx" ON "Expense"("monthlyPeriodId", "importHash");

-- CreateIndex
CREATE INDEX "Expense_receiptId_idx" ON "Expense"("receiptId");

-- CreateIndex
CREATE INDEX "Expense_taxApplicability_spentAt_idx" ON "Expense"("taxApplicability", "spentAt");

-- CreateIndex
CREATE INDEX "TaxExpenseAudit_expenseId_createdAt_idx" ON "TaxExpenseAudit"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "TaxExpenseAudit_createdAt_idx" ON "TaxExpenseAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidItem_itemId_key" ON "PlaidItem"("itemId");

-- AddForeignKey
ALTER TABLE "Paycheck" ADD CONSTRAINT "Paycheck_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_taxReviewedByUserId_fkey" FOREIGN KEY ("taxReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxExpenseAudit" ADD CONSTRAINT "TaxExpenseAudit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxExpenseAudit" ADD CONSTRAINT "TaxExpenseAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidItem" ADD CONSTRAINT "PlaidItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_monthlyPeriodId_fkey" FOREIGN KEY ("monthlyPeriodId") REFERENCES "MonthlyPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingTripItem" ADD CONSTRAINT "ShoppingTripItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShoppingTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingAdjustment" ADD CONSTRAINT "SpendingAdjustment_savingsGoalId_fkey" FOREIGN KEY ("savingsGoalId") REFERENCES "SavingsGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

