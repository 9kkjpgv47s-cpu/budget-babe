import { prisma } from "@/lib/prisma";
import { ensureDefaultCategories } from "@/lib/categories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { QuickForms } from "./QuickForms";

export async function QuickFormsSection({ yearMonth }: { yearMonth: string }) {
  await ensureDefaultCategories();
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const [categories, budgetPlans] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.budgetPlan.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <QuickForms
      yearMonth={yearMonth}
      categories={categories}
      budgetPlans={budgetPlans}
    />
  );
}
