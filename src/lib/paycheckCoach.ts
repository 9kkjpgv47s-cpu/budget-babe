import { addDays, isAfter, startOfDay } from "date-fns";
import { formatCents } from "@/lib/money";

/** Valid savings targets: 5% of each paycheck up to 40% */
export const SAVINGS_RATE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40] as const;

export type CoachBill = {
  id: string;
  title: string;
  amountCents: number;
  dueDate: Date;
  paid: boolean;
};

export type CoachBudgetLine = {
  name: string;
  category: string | null;
  limitCents: number;
};

export type PaycheckCoachInput = {
  monthlyIncomeCents: number;
  payPeriodsPerMonth: number;
  savingsRatePercent: number;
  nextPaycheck: Date | null;
  bills: CoachBill[];
  budgetPlans: CoachBudgetLine[];
  /** Total variable spending logged this calendar month (approximation) */
  monthSpendCents: number;
};

export type TwoWeekBill = {
  id: string;
  title: string;
  amountCents: number;
  dueDate: Date;
  week: 1 | 2;
};

export type PaycheckCoachResult = {
  perPaycheckIncomeCents: number;
  savingsThisPayCents: number;
  savingsRatePercent: number;
  billsBeforePay: CoachBill[];
  billsBeforePaySumCents: number;
  billsAfterPayTwoWeeks: TwoWeekBill[];
  billsAfterPayTwoWeeksSumCents: number;
  /** Bills due in week 1 after pay (exclusive of pay day) */
  week1Bills: TwoWeekBill[];
  week1BillsSumCents: number;
  /** Bills due in week 2 */
  week2Bills: TwoWeekBill[];
  week2BillsSumCents: number;
  /** After savings + all bills in scope (before + two weeks after pay) */
  afterObligationsCents: number;
  groceryBudgetLimitCents: number | null;
  /** Suggested grocery cap this pay (min of budget line and affordable slice) */
  suggestedGroceryCapCents: number;
  /** Discretionary after savings, bills, and grocery cap */
  freeSpendingCapCents: number;
  /** Rough: month spend / pay periods (for awareness) */
  impliedSpendPerPayCents: number;
  recommendations: string[];
  /** Half of free cap per week as a soft guide */
  week1DiscretionaryGuideCents: number;
  week2DiscretionaryGuideCents: number;
};

function findGroceryLimit(plans: CoachBudgetLine[]): number | null {
  const g = plans.find(
    (p) =>
      p.name.toLowerCase().includes("grocer") ||
      (p.category?.toLowerCase().includes("grocer") ?? false),
  );
  return g?.limitCents ?? null;
}

/**
 * Bills due strictly after `pay` through end of calendar day `pay + 14`.
 */
function billsInTwoWeeksAfterPay(
  bills: CoachBill[],
  pay: Date,
): TwoWeekBill[] {
  const payDay = startOfDay(pay);
  const lastDay = startOfDay(addDays(pay, 14));
  const out: TwoWeekBill[] = [];

  for (const b of bills) {
    if (b.paid) continue;
    const d = startOfDay(b.dueDate);
    if (!isAfter(d, payDay)) continue;
    if (isAfter(d, lastDay)) continue;
    const mid = startOfDay(addDays(pay, 7));
    const week: 1 | 2 = !isAfter(d, mid) ? 1 : 2;
    out.push({
      id: b.id,
      title: b.title,
      amountCents: b.amountCents,
      dueDate: b.dueDate,
      week,
    });
  }
  out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return out;
}

export function buildPaycheckCoach(input: PaycheckCoachInput): PaycheckCoachResult | null {
  const {
    monthlyIncomeCents,
    payPeriodsPerMonth,
    savingsRatePercent,
    nextPaycheck,
    bills,
    budgetPlans,
    monthSpendCents,
  } = input;

  if (monthlyIncomeCents <= 0 || payPeriodsPerMonth < 1) {
    return null;
  }

  const perPaycheckIncomeCents = Math.round(
    monthlyIncomeCents / payPeriodsPerMonth,
  );
  const savingsThisPayCents = Math.round(
    (perPaycheckIncomeCents * savingsRatePercent) / 100,
  );

  const pay = nextPaycheck ?? null;
  const billsBeforePay: CoachBill[] = pay
    ? bills.filter((b) => !b.paid && b.dueDate <= pay)
    : bills.filter((b) => !b.paid);

  const billsBeforePaySumCents = billsBeforePay.reduce(
    (s, b) => s + b.amountCents,
    0,
  );

  const billsAfter = pay ? billsInTwoWeeksAfterPay(bills, pay) : [];
  const billsAfterPayTwoWeeksSumCents = billsAfter.reduce(
    (s, b) => s + b.amountCents,
    0,
  );
  const week1Bills = billsAfter.filter((b) => b.week === 1);
  const week2Bills = billsAfter.filter((b) => b.week === 2);
  const week1BillsSumCents = week1Bills.reduce((s, b) => s + b.amountCents, 0);
  const week2BillsSumCents = week2Bills.reduce((s, b) => s + b.amountCents, 0);

  const totalBillsThisCycleCents =
    billsBeforePaySumCents + billsAfterPayTwoWeeksSumCents;

  const afterObligationsCents =
    perPaycheckIncomeCents -
    savingsThisPayCents -
    totalBillsThisCycleCents;

  const groceryBudgetLimitCents = findGroceryLimit(budgetPlans);

  /** Aim groceries at ~18% of take-home per pay, capped by budget line and what's left */
  const groceryFromPercent = Math.round(perPaycheckIncomeCents * 0.18);
  const affordableGrocery = Math.max(0, afterObligationsCents);
  let suggestedGroceryCapCents = Math.min(
    groceryFromPercent,
    affordableGrocery,
  );
  if (groceryBudgetLimitCents != null) {
    suggestedGroceryCapCents = Math.min(
      suggestedGroceryCapCents,
      groceryBudgetLimitCents,
    );
  }

  const freeSpendingCapCents = Math.max(
    0,
    afterObligationsCents - suggestedGroceryCapCents,
  );

  const impliedSpendPerPayCents = Math.round(
    monthSpendCents / Math.max(1, payPeriodsPerMonth),
  );

  const halfFree = Math.round(freeSpendingCapCents / 2);
  const week1DiscretionaryGuideCents = halfFree;
  const week2DiscretionaryGuideCents = freeSpendingCapCents - halfFree;

  const recommendations: string[] = [];

  if (!nextPaycheck) {
    recommendations.push(
      "Set your next paycheck date in Overview so we can split bills into the two weeks after pay and tighten the plan.",
    );
  }

  recommendations.push(
    `Treat ${formatCents(savingsThisPayCents)} as must-save this paycheck (${savingsRatePercent}% of ${formatCents(perPaycheckIncomeCents)} take-home per pay).`,
  );

  if (afterObligationsCents < 0) {
    recommendations.push(
      "Bills plus your savings target exceed this paycheck's share of income. Raise income in settings, lower the savings % temporarily, move a bill, or pay some bills from last cycle's surplus.",
    );
  } else if (freeSpendingCapCents < Math.round(perPaycheckIncomeCents * 0.05)) {
    recommendations.push(
      "Very little is left for variable spending after bills and savings — watch discretionary purchases until the next check.",
    );
  } else {
    recommendations.push(
      `After savings, scheduled bills, and a ${formatCents(suggestedGroceryCapCents)} grocery cap, about ${formatCents(freeSpendingCapCents)} is left for other spending this two-week window.`,
    );
  }

  if (
    groceryBudgetLimitCents != null &&
    suggestedGroceryCapCents < groceryBudgetLimitCents * 0.85
  ) {
    recommendations.push(
      `Your "Groceries" budget line is ${formatCents(groceryBudgetLimitCents)}; this cycle we suggest capping at ${formatCents(suggestedGroceryCapCents)} so you still end the pay period with cushion.`,
    );
  }

  if (impliedSpendPerPayCents > freeSpendingCapCents + suggestedGroceryCapCents) {
    recommendations.push(
      `You have logged about ${formatCents(impliedSpendPerPayCents)} per pay period in spending this month — compare to the caps above and trim if you want extra money left at the end of each check.`,
    );
  }

  return {
    perPaycheckIncomeCents,
    savingsThisPayCents,
    savingsRatePercent,
    billsBeforePay,
    billsBeforePaySumCents,
    billsAfterPayTwoWeeks: billsAfter,
    billsAfterPayTwoWeeksSumCents,
    week1Bills,
    week1BillsSumCents,
    week2Bills,
    week2BillsSumCents,
    afterObligationsCents,
    groceryBudgetLimitCents,
    suggestedGroceryCapCents,
    freeSpendingCapCents,
    impliedSpendPerPayCents,
    recommendations,
    week1DiscretionaryGuideCents,
    week2DiscretionaryGuideCents,
  };
}
