"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureHouseholdSettings } from "@/lib/dashboardData";
import { SAVINGS_RATE_OPTIONS } from "@/lib/paycheckCoach";

export async function updateCoachSettingsAction(formData: FormData): Promise<void> {
  await requireUser();
  await ensureHouseholdSettings();
  const rateRaw = Number.parseInt(String(formData.get("savingsRatePercent") ?? ""), 10);
  const periodsRaw = Number.parseInt(String(formData.get("payPeriodsPerMonth") ?? ""), 10);

  const rate = Number.isFinite(rateRaw) ? rateRaw : 10;
  const periods = Number.isFinite(periodsRaw) ? periodsRaw : 2;

  const validRate = (SAVINGS_RATE_OPTIONS as readonly number[]).includes(rate)
    ? rate
    : 10;
  const validPeriods = Math.min(4, Math.max(1, periods));

  await prisma.householdSettings.update({
    where: { id: 1 },
    data: {
      savingsRatePercentTarget: validRate,
      payPeriodsPerMonth: validPeriods,
    },
  });
  revalidatePath("/");
  revalidatePath("/coach");
}
