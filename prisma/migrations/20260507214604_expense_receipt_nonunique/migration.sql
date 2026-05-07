-- DropIndex
DROP INDEX "Expense_receiptId_key";

-- CreateIndex
CREATE INDEX "Expense_receiptId_idx" ON "Expense"("receiptId");
