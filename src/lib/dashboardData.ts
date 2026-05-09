import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getOrCreateMonthlyPeriod(yearMonth: string) {
  const existing = await prisma.monthlyPeriod.findUnique({
    where: { yearMonth },
  });
  if (existing) return existing;
  try {
    return await prisma.monthlyPeriod.create({
      data: { yearMonth },
    });
  } catch (error) {
    /**
     * First request for a new month can race under load. If another request
     * wins the create, fall back to reading the row it inserted.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.monthlyPeriod.findUnique({
        where: { yearMonth },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function ensureHouseholdSettings() {
  const existing = await prisma.householdSettings.findUnique({
    where: { id: 1 },
    select: { id: true },
  });
  if (existing) return;

  try {
    await prisma.householdSettings.create({
      data: { id: 1 },
    });
  } catch (error) {
    /**
     * Another concurrent request may create the singleton row first.
     * Treat uniqueness conflicts as success.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
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

  const [expenses, bills, budgetPlans, receipts, savingsGoals, paychecks] =
    await Promise.all([
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
    prisma.savingsGoal.findMany({
      orderBy: { title: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        targetAmountCents: true,
        savedAmountCents: true,
      },
    }),
    prisma.paycheck.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { receivedOn: "desc" },
    }),
  ]);

  const paycheckSum = paychecks.reduce((s, p) => s + p.amountCents, 0);
  /** Sum of paycheck rows when present; otherwise legacy planned income on the period. */
  const incomeCents =
    paychecks.length > 0 ? paycheckSum : period.incomeCents;

  const spentTotal = expenses.reduce((s, e) => s + e.amountCents, 0);
  const billsBeforePay = nextPay
    ? bills.filter((b) => !b.paid && b.dueDate <= nextPay)
    : bills.filter((b) => !b.paid);
  const billsBeforePaySum = billsBeforePay.reduce((s, b) => s + b.amountCents, 0);
  const allBillsSum = bills.reduce((s, b) => s + b.amountCents, 0);
  const unpaidBillsSum = bills
    .filter((b) => !b.paid)
    .reduce((s, b) => s + b.amountCents, 0);

  const leftAfterUpcomingBills = incomeCents - spentTotal - billsBeforePaySum;
  const leftAfterAllBills = incomeCents - spentTotal - unpaidBillsSum;

  return {
    period,
    incomeCents,
    paychecks,
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
    savingsGoals,
  };
}
