-- Performance indexes for month-scoped queries and reporting

CREATE INDEX IF NOT EXISTS "Expense_monthlyPeriodId_spentAt_idx" ON "Expense"("monthlyPeriodId", "spentAt");
CREATE INDEX IF NOT EXISTS "Expense_spentAt_idx" ON "Expense"("spentAt");
CREATE INDEX IF NOT EXISTS "Bill_monthlyPeriodId_idx" ON "Bill"("monthlyPeriodId");
CREATE INDEX IF NOT EXISTS "BudgetPlan_monthlyPeriodId_idx" ON "BudgetPlan"("monthlyPeriodId");
CREATE INDEX IF NOT EXISTS "Receipt_monthlyPeriodId_idx" ON "Receipt"("monthlyPeriodId");
CREATE INDEX IF NOT EXISTS "ShoppingTrip_shoppedAt_idx" ON "ShoppingTrip"("shoppedAt");
