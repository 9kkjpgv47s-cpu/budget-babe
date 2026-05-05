import { prisma } from "@/lib/prisma";

export async function getOrCreateMonthlyPeriod(yearMonth: string) {
  const existing = await prisma.monthlyPeriod.findUnique({
    where: { yearMonth },
  });
  if (existing) return existing;
  return prisma.monthlyPeriod.create({
    data: { yearMonth },
  });
}

export async function ensureHouseholdSettings() {
  await prisma.householdSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

export async function getDashboardData(yearMonth: string) {
  await ensureHouseholdSettings();
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const settings = await prisma.householdSettings.findUnique({
    where: { id: 1 },
  });
  const nextPay = settings?.nextPaycheckDate ?? null;
  const savingsRatePercentTarget = settings?.savingsRatePercentTarget ?? 10;
  const payPeriodsPerMonth = settings?.payPeriodsPerMonth ?? 2;

  const [expenses, bills, budgetPlans, receipts] = await Promise.all([
    prisma.expense.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { spentAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.bill.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { dueDate: "asc" },
    }),
    prisma.budgetPlan.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { name: "asc" },
    }),
    prisma.receipt.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { uploadedAt: "desc" },
      take: 20,
    }),
  ]);

  const spentTotal = expenses.reduce((s, e) => s + e.amountCents, 0);
  const billsBeforePay = nextPay
    ? bills.filter((b) => !b.paid && b.dueDate <= nextPay)
    : bills.filter((b) => !b.paid);
  const billsBeforePaySum = billsBeforePay.reduce((s, b) => s + b.amountCents, 0);
  const allBillsSum = bills.reduce((s, b) => s + b.amountCents, 0);
  const unpaidBillsSum = bills
    .filter((b) => !b.paid)
    .reduce((s, b) => s + b.amountCents, 0);

  const income = period.incomeCents;
  const leftAfterUpcomingBills = income - spentTotal - billsBeforePaySum;
  const leftAfterAllBills = income - spentTotal - unpaidBillsSum;

  return {
    period,
    nextPaycheckDate: nextPay,
    expenses,
    bills,
    billsBeforePay,
    budgetPlans,
    receipts,
    spentTotal,
    billsBeforePaySum,
    allBillsSum,
    unpaidBillsSum,
    leftAfterUpcomingBills,
    leftAfterAllBills,
    savingsRatePercentTarget,
    payPeriodsPerMonth,
  };
}
